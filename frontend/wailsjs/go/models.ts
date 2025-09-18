export namespace main {
	
	export class AppConfig {
	    currentContext: string;
	    currentNamespace: string;
	    rememberContext: boolean;
	    rememberNamespace: boolean;
	
	    static createFrom(source: any = {}) {
	        return new AppConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentContext = source["currentContext"];
	        this.currentNamespace = source["currentNamespace"];
	        this.rememberContext = source["rememberContext"];
	        this.rememberNamespace = source["rememberNamespace"];
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
	
	    static createFrom(source: any = {}) {
	        return new PodInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.restarts = source["restarts"];
	        this.uptime = source["uptime"];
	        this.startTime = source["startTime"];
	    }
	}

}

