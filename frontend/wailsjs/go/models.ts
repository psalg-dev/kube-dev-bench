export namespace app {
	
	export class AppConfig {
	    currentContext: string;
	    currentNamespace: string;
	    rememberContext: boolean;
	    rememberNamespace: boolean;
	    kubeConfigPath: string;
	
	    static createFrom(source: any = {}) {
	        return new AppConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentContext = source["currentContext"];
	        this.currentNamespace = source["currentNamespace"];
	        this.rememberContext = source["rememberContext"];
	        this.rememberNamespace = source["rememberNamespace"];
	        this.kubeConfigPath = source["kubeConfigPath"];
	    }
	}
	export class EventInfo {
	    type: string;
	    reason: string;
	    message: string;
	    count: number;
	    // Go type: time
	    firstTimestamp: any;
	    // Go type: time
	    lastTimestamp: any;
	    source: string;
	
	    static createFrom(source: any = {}) {
	        return new EventInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.reason = source["reason"];
	        this.message = source["message"];
	        this.count = source["count"];
	        this.firstTimestamp = this.convertValues(source["firstTimestamp"], null);
	        this.lastTimestamp = this.convertValues(source["lastTimestamp"], null);
	        this.source = source["source"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class KubeConfigInfo {
	    path: string;
	    name: string;
	    contexts: string[];
	
	    static createFrom(source: any = {}) {
	        return new KubeConfigInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	        this.contexts = source["contexts"];
	    }
	}
	export class OverviewInfo {
	    pods: number;
	    deployments: number;
	    jobs: number;
	
	    static createFrom(source: any = {}) {
	        return new OverviewInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pods = source["pods"];
	        this.deployments = source["deployments"];
	        this.jobs = source["jobs"];
	    }
	}
	export class PodInfo {
	    name: string;
	    restarts: number;
	    uptime: string;
	    startTime: string;
	    ports: number[];
	
	    static createFrom(source: any = {}) {
	        return new PodInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.restarts = source["restarts"];
	        this.uptime = source["uptime"];
	        this.startTime = source["startTime"];
	        this.ports = source["ports"];
	    }
	}
	export class PodSummary {
	    name: string;
	    namespace: string;
	    // Go type: time
	    created: any;
	    labels: Record<string, string>;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new PodSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.created = this.convertValues(source["created"], null);
	        this.labels = source["labels"];
	        this.status = source["status"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class PortForwardInfo {
	    namespace: string;
	    pod: string;
	    local: number;
	    remote: number;
	
	    static createFrom(source: any = {}) {
	        return new PortForwardInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.namespace = source["namespace"];
	        this.pod = source["pod"];
	        this.local = source["local"];
	        this.remote = source["remote"];
	    }
	}

}

