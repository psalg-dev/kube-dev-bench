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
	export class MountInfo {
	    name: string;
	    mountPath: string;
	    readOnly: boolean;
	    subPath?: string;
	
	    static createFrom(source: any = {}) {
	        return new MountInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.mountPath = source["mountPath"];
	        this.readOnly = source["readOnly"];
	        this.subPath = source["subPath"];
	    }
	}
	export class ContainerMountInfo {
	    container: string;
	    isInit: boolean;
	    mounts: MountInfo[];
	
	    static createFrom(source: any = {}) {
	        return new ContainerMountInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.container = source["container"];
	        this.isInit = source["isInit"];
	        this.mounts = this.convertValues(source["mounts"], MountInfo);
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
	export class CronJobInfo {
	    name: string;
	    namespace: string;
	    schedule: string;
	    suspend: boolean;
	    age: string;
	    image: string;
	    nextRun: string;
	
	    static createFrom(source: any = {}) {
	        return new CronJobInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.schedule = source["schedule"];
	        this.suspend = source["suspend"];
	        this.age = source["age"];
	        this.image = source["image"];
	        this.nextRun = source["nextRun"];
	    }
	}
	export class DeploymentInfo {
	    name: string;
	    namespace: string;
	    replicas: number;
	    ready: number;
	    available: number;
	    age: string;
	    image: string;
	
	    static createFrom(source: any = {}) {
	        return new DeploymentInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.replicas = source["replicas"];
	        this.ready = source["ready"];
	        this.available = source["available"];
	        this.age = source["age"];
	        this.image = source["image"];
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
	export class JobInfo {
	    name: string;
	    namespace: string;
	    completions: number;
	    succeeded: number;
	    active: number;
	    failed: number;
	    age: string;
	    image: string;
	    duration: string;
	
	    static createFrom(source: any = {}) {
	        return new JobInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.completions = source["completions"];
	        this.succeeded = source["succeeded"];
	        this.active = source["active"];
	        this.failed = source["failed"];
	        this.age = source["age"];
	        this.image = source["image"];
	        this.duration = source["duration"];
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
	    status: string;
	
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
	        this.status = source["status"];
	    }
	}
	export class VolumeInfo {
	    name: string;
	    type: string;
	    secretName?: string;
	    configMapName?: string;
	    pvc?: string;
	    hostPath?: string;
	    emptyDir?: boolean;
	    projectedSecretNames?: string[];
	    projectedConfigMapNames?: string[];
	
	    static createFrom(source: any = {}) {
	        return new VolumeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.type = source["type"];
	        this.secretName = source["secretName"];
	        this.configMapName = source["configMapName"];
	        this.pvc = source["pvc"];
	        this.hostPath = source["hostPath"];
	        this.emptyDir = source["emptyDir"];
	        this.projectedSecretNames = source["projectedSecretNames"];
	        this.projectedConfigMapNames = source["projectedConfigMapNames"];
	    }
	}
	export class PodMounts {
	    volumes: VolumeInfo[];
	    containers: ContainerMountInfo[];
	
	    static createFrom(source: any = {}) {
	        return new PodMounts(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.volumes = this.convertValues(source["volumes"], VolumeInfo);
	        this.containers = this.convertValues(source["containers"], ContainerMountInfo);
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
	export class PodStatusCounts {
	    running: number;
	    pending: number;
	    failed: number;
	    succeeded: number;
	    unknown: number;
	    total: number;
	
	    static createFrom(source: any = {}) {
	        return new PodStatusCounts(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.pending = source["pending"];
	        this.failed = source["failed"];
	        this.succeeded = source["succeeded"];
	        this.unknown = source["unknown"];
	        this.total = source["total"];
	    }
	}
	export class PodSummary {
	    name: string;
	    namespace: string;
	    // Go type: time
	    created: any;
	    labels: Record<string, string>;
	    status: string;
	    ports: number[];
	
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
	        this.ports = source["ports"];
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

