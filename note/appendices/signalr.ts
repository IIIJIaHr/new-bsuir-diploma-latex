module MRScan {
	export class SignalRConnection implements Patterns.IObservable {
		private static instance: SignalRConnection = new SignalRConnection();
		private connectingInterval: number = 500;
		private waitTime: number = 10000;
		private mrScanNotinstalledUrl: string = "WebRC/Shared/MRScan.aspx";
		public connectionUrl: string;
		private hubName: string = "MRScanHub";
		private chat;
		private observers = {};

		constructor() {
			if (SignalRConnection.instance)
				throw new Error("Use SignalRConnection.getInstance()");

			SignalRConnection.instance = this;
		}

		private isConnected(): boolean {
			return this.chat.connection.state === ConnectionState.Connected;
		}

		static getInstance(): SignalRConnection {
			return SignalRConnection.instance;
		}

		setUpListeners(): void {
			$.connection.hub.logging = true;
			$.connection.hub.url = this.connectionUrl;
			this.chat = $.connection[this.hubName];

			this.chat.client.AddMessage = (type, message) => {
				this.notifyObservers(type, message);
			};
			$.connection.hub.stateChanged((change) => {
				if (change.newState === $.signalR.connectionState.reconnecting) {
					console.log('Re-connecting');
				}
				else if (change.newState === $.signalR.connectionState.connected) {
					console.log('connected');
				}
				else if (change.newState === $.signalR.connectionState.disconnected) {
					console.log('disconnected');
				}
				else if (change.newState === $.signalR.connectionState.connecting) {
					console.log('connecting');
				}
			});

			$.connection.hub.error((err) => {
				console.log(err);
			});
		}

		connect(url: string): JQueryPromise {
			var def: JQueryDeferred = $.Deferred();


			this.connectionUrl = url;
			this.setUpListeners();

			if (this.isConnected())
				return def.resolve();

			var tryConnectId = setInterval(() => {
				console.log("trying to connect");
				$.connection.hub.start({ jsonp: true }).done(() => {
					clearInterval(tryConnectId);
					def.resolve();
					console.log("connection started");
				})
			}, this.connectingInterval);

			var waitSuccessConnId = setTimeout(() => {
				if (!this.isConnected()) {
					clearInterval(tryConnectId);
					def.reject();
				}
			}, this.waitTime)

			return def;
		}

		registerObserver(observer: any, type: string) {
			var isPresent = false;

			if (!this.observers[type])
				this.observers[type] = [];

			this.observers[type].forEach((obs) => {
				isPresent = this.isObserversEqual(obs, observer);
			});

			if (!isPresent)
				this.observers[type].push(observer);
		}

		isObserversEqual(first, second): boolean {
			if ("freeNum" in first && "freeNum" in second) {
				if (first.freeNum === second.freeNum) {
					return first.constructor === second.constructor;
				}
			} else
				return first.constructor === second.constructor;
		}

		removeObserver(observer: any, type: string) {
			if (!this.observers[type])
				return;

			var index = this.observers[type].indexOf(observer)

			if (~index) {
				this.observers[type].splice(index, 1)
			}
		}

		notifyObservers(type: string, message: string) {
			if (!this.observers[type])
				return;

			this.observers[type].forEach((observer) => {
				observer.receiveNotification(message);
			});

		}

		send(title, message) {
			if (this.chat.connection.state != ConnectionState.Connected) {
				deloAlert("MRScan недоступен. Перезапустите MRScan и попробуйте снова.");
				return;
			}
			this.chat.server.send(title, message).fail((err) => {
				console.log("send failed", err);
			});
		}
	}

	export enum ConnectionState {
		Connecting = 0,
		Connected = 1,
		Disconnected = 4,
	}
}