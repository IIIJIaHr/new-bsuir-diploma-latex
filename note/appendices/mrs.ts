module MRScan {
	export class MRScanManager implements Patterns.IObserver {
		protected ticketId: string;
		protected ticketDate: string;
		protected siteId: string;
		protected machineName: string;
		protected openDesktop: string;
		protected connection: SignalRConnection = SignalRConnection.getInstance();
		protected createTicketParams = {
			command: "create_ticket",
			type: this.operationType,
			with_date: "true",
			container_id: this.containerId
		};

		private getSiteIdParams = {
			command: "get_site_id"
		}

		public constructor(private containerId: string, private kindDoc: number, private freeNum: string, private operationType: string, protected refreshCallback: () => void) {

		}

		public receiveNotification(message: string) {
			if (message == "file attached") {
				this.refreshCallback();
			}
		}

		public clearTickets(): JQueryPromise {
			var closeTicketParams = {
				command: "clear_tickets",
				ticketId: this.ticketId,
			}

			var url = UrlManager.serverHandlerUrl + $.param(closeTicketParams);

			return $.ajax(url);
		}

		public setTicketStatus(status: string): JQueryPromise {
			var params = {
				command: "set_status",
				ticketId: this.ticketId,
				status: status,
			}

			var url = UrlManager.serverHandlerUrl + $.param(params);

			return $.ajax(url);
		}

		protected makeCreateTicketParams(): string {
			return $.param(this.createTicketParams);
		}

		public createTicket(): JQueryPromise {
			var url = UrlManager.serverHandlerUrl + this.makeCreateTicketParams();

			return $.ajax(url);
		}

		public getSiteId(): JQueryPromise {
			var url = UrlManager.serverHandlerUrl + $.param(this.getSiteIdParams);

			return $.ajax(url);
		}

		public loadMachineName(): JQueryPromise {
			var params = {
				command: "get_machine_name",
				ticketId: this.ticketId
			};

			var url = UrlManager.serverHandlerUrl + $.param(params);

			return $.ajax(url)
		}

		protected loadData(): JQueryPromise {
			return this.createTicket().then((data) => {
				this.parseTicket(data);
			}).then(() => {
				return this.getSiteId();
			}).then((data) => {
				this.parseSiteId(data);
			});
		}

		protected getUrl(): JQueryPromise {

			return this.loadData().then(() => {
				return this.makeUrl();
			});
		}

		public runMRScan(): JQueryPromise {
			this.connection.registerObserver(this, "Scan");

			return this.getUrl().then((url) => {
				location.href = url;
			}).then(() => {
				return this.startSignalR();
			}).fail((e) => {
				console.log(e);
				openPopUp("../Shared/MRScan.aspx");
			});
		}
		public startSignalR(): JQueryPromise {
			if (UrlManager.isSSl())
				return this.getMachineName().then((machineName) => {
					return this.connection.connect(UrlManager.getConnectionUrl(machineName));
				});
			else {
				return this.connection.connect(UrlManager.getConnectionUrl());
			}
		}

		public getMachineName(): JQueryPromise {
			var def = $.Deferred();

			if (!UrlManager.isSSl())
				return def.resolve("localhost");
			else if (this.machineName)
				return def.resolve(this.machineName);

			var intervalId = setInterval(() => {
				this.loadMachineName().then((data) => {
					if (data !== "") {
						def.resolve(data);
						clearInterval(intervalId);
					}
				})
			}, 1000);

			return def;
		}

		protected makeUrl(): string {
			var url = UrlManager.customProtocol;

			url += $.param({
				type: this.operationType,
				container_id: this.containerId,
				ticketId: this.ticketId,
				ticketDate: this.ticketDate,
				siteId: this.siteId,
				kDoc: this.kindDoc,
				fNum: this.freeNum,
				sessionId: pageContext.CurrentUser.ISN_LCLASSIF,
				usName: pageContext.CurrentUser.SURNAME_PATRON,
				srvUrl: UrlManager.serviceUrl,
				tMUrl: UrlManager.ticketManUrl,
				prtl: UrlManager.getSiteProtocol()
			});

			return url;
		}

		protected parseTicket(data: string): void {
			var responseObjects = data.split("#;");

			this.ticketId = responseObjects[0];
			this.ticketDate = responseObjects[1];
		}

		protected parseSiteId(data: string): void {
			this.siteId = data;
		}

		protected parseMachineName(data: string): void {
			this.machineName = data;
		}

		public registerObserver(obs: any, type: string) {
			this.connection.registerObserver(obs, type);
		}

		public send(type: string, message: string) {
			this.connection.send(type, message);
		}
	}

	export class MRScanManagerEdit extends MRScanManager {
		constructor(containerId: string, kindDoc: number, freeNum: string, operationType: string, protected refreshCallback: () => void, protected fileId: number, protected fileName: string, protected it: P.MItem) {
			super(containerId, kindDoc, freeNum, operationType, refreshCallback);
		}

		makeUrl(): string {
			var baseUrl = super.makeUrl();
			var result = baseUrl + "&" + $.param({
				fileId: this.fileId,
				fName: this.fileName
			});

			return result;
		}

		makeCreateTicketParams(): string {
			this.createTicketParams["fileid"] = this.fileId;
			return super.makeCreateTicketParams();
		}

		receiveNotification(message: string): void {
			switch (message) {
				case "refresh":
					break;
				case "Running":
					osp(this.it, "ContentsEdit", false);
					break;
			}
		}
	}
}