export namespace app {
	
	export class AppConfig {
	    currentContext: string;
	    currentNamespace: string;
	    preferredNamespaces: string[];
	    rememberContext: boolean;
	    rememberNamespace: boolean;
	    kubeConfigPath: string;
	    proxyURL: string;
	    proxyAuthType: string;
	    proxyUsername: string;
	    proxyPassword: string;
	
	    static createFrom(source: any = {}) {
	        return new AppConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.currentContext = source["currentContext"];
	        this.currentNamespace = source["currentNamespace"];
	        this.preferredNamespaces = source["preferredNamespaces"];
	        this.rememberContext = source["rememberContext"];
	        this.rememberNamespace = source["rememberNamespace"];
	        this.kubeConfigPath = source["kubeConfigPath"];
	        this.proxyURL = source["proxyURL"];
	        this.proxyAuthType = source["proxyAuthType"];
	        this.proxyUsername = source["proxyUsername"];
	        this.proxyPassword = source["proxyPassword"];
	    }
	}
	export class ArchiveResult {
	    path: string;
	    base64: string;
	    truncated: boolean;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new ArchiveResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.base64 = source["base64"];
	        this.truncated = source["truncated"];
	        this.size = source["size"];
	    }
	}
	export class ConfigMapConsumer {
	    kind: string;
	    name: string;
	    namespace: string;
	    refType?: string;
	
	    static createFrom(source: any = {}) {
	        return new ConfigMapConsumer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.refType = source["refType"];
	    }
	}
	export class ConfigMapDataInfo {
	    key: string;
	    value: string;
	    size: number;
	    isBinary: boolean;
	
	    static createFrom(source: any = {}) {
	        return new ConfigMapDataInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	        this.size = source["size"];
	        this.isBinary = source["isBinary"];
	    }
	}
	export class ConfigMapInfo {
	    name: string;
	    namespace: string;
	    age: string;
	    keys: number;
	    size: string;
	    labels: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new ConfigMapInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.age = source["age"];
	        this.keys = source["keys"];
	        this.size = source["size"];
	        this.labels = source["labels"];
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
	export class CronJobJobInfo {
	    name: string;
	    namespace: string;
	    status: string;
	    startTime: string;
	    endTime: string;
	    duration: string;
	    succeeded: number;
	    failed: number;
	    active: number;
	
	    static createFrom(source: any = {}) {
	        return new CronJobJobInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.status = source["status"];
	        this.startTime = source["startTime"];
	        this.endTime = source["endTime"];
	        this.duration = source["duration"];
	        this.succeeded = source["succeeded"];
	        this.failed = source["failed"];
	        this.active = source["active"];
	    }
	}
	export class CronJobDetail {
	    jobs: CronJobJobInfo[];
	    nextRuns: string[];
	
	    static createFrom(source: any = {}) {
	        return new CronJobDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.jobs = this.convertValues(source["jobs"], CronJobJobInfo);
	        this.nextRuns = source["nextRuns"];
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
	    labels: Record<string, string>;
	
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
	        this.labels = source["labels"];
	    }
	}
	
	export class ResourcePodInfo {
	    name: string;
	    namespace: string;
	    status: string;
	    ready: string;
	    restarts: number;
	    age: string;
	    node: string;
	    ip: string;
	
	    static createFrom(source: any = {}) {
	        return new ResourcePodInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.status = source["status"];
	        this.ready = source["ready"];
	        this.restarts = source["restarts"];
	        this.age = source["age"];
	        this.node = source["node"];
	        this.ip = source["ip"];
	    }
	}
	export class DaemonSetDetail {
	    pods: ResourcePodInfo[];
	
	    static createFrom(source: any = {}) {
	        return new DaemonSetDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pods = this.convertValues(source["pods"], ResourcePodInfo);
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
	export class DaemonSetInfo {
	    name: string;
	    namespace: string;
	    desired: number;
	    current: number;
	    age: string;
	    image: string;
	    labels: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new DaemonSetInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.desired = source["desired"];
	        this.current = source["current"];
	        this.age = source["age"];
	        this.image = source["image"];
	        this.labels = source["labels"];
	    }
	}
	export class DaemonSetNodeCoverageEntry {
	    node: string;
	    hasPod: boolean;
	    podName?: string;
	    podStatus?: string;
	    ready?: string;
	
	    static createFrom(source: any = {}) {
	        return new DaemonSetNodeCoverageEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.node = source["node"];
	        this.hasPod = source["hasPod"];
	        this.podName = source["podName"];
	        this.podStatus = source["podStatus"];
	        this.ready = source["ready"];
	    }
	}
	export class DaemonSetNodeCoverage {
	    nodes: DaemonSetNodeCoverageEntry[];
	
	    static createFrom(source: any = {}) {
	        return new DaemonSetNodeCoverage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nodes = this.convertValues(source["nodes"], DaemonSetNodeCoverageEntry);
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
	
	export class DeploymentCondition {
	    type: string;
	    status: string;
	    lastTransition: string;
	    reason: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new DeploymentCondition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.status = source["status"];
	        this.lastTransition = source["lastTransition"];
	        this.reason = source["reason"];
	        this.message = source["message"];
	    }
	}
	export class RolloutRevision {
	    revision: number;
	    replicaSet: string;
	    image: string;
	    createdAt: string;
	    replicas: number;
	    isCurrent: boolean;
	
	    static createFrom(source: any = {}) {
	        return new RolloutRevision(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.revision = source["revision"];
	        this.replicaSet = source["replicaSet"];
	        this.image = source["image"];
	        this.createdAt = source["createdAt"];
	        this.replicas = source["replicas"];
	        this.isCurrent = source["isCurrent"];
	    }
	}
	export class DeploymentDetail {
	    pods: ResourcePodInfo[];
	    conditions: DeploymentCondition[];
	    revisions: RolloutRevision[];
	
	    static createFrom(source: any = {}) {
	        return new DeploymentDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pods = this.convertValues(source["pods"], ResourcePodInfo);
	        this.conditions = this.convertValues(source["conditions"], DeploymentCondition);
	        this.revisions = this.convertValues(source["revisions"], RolloutRevision);
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
	export class DeploymentInfo {
	    name: string;
	    namespace: string;
	    replicas: number;
	    ready: number;
	    available: number;
	    age: string;
	    image: string;
	    labels: Record<string, string>;
	
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
	        this.labels = source["labels"];
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
	export class HelmChartInfo {
	    name: string;
	    repo: string;
	    version: string;
	    appVersion: string;
	    description: string;
	    versions: string[];
	
	    static createFrom(source: any = {}) {
	        return new HelmChartInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.repo = source["repo"];
	        this.version = source["version"];
	        this.appVersion = source["appVersion"];
	        this.description = source["description"];
	        this.versions = source["versions"];
	    }
	}
	export class HelmChartVersionInfo {
	    version: string;
	    appVersion: string;
	    description: string;
	    created: string;
	
	    static createFrom(source: any = {}) {
	        return new HelmChartVersionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.version = source["version"];
	        this.appVersion = source["appVersion"];
	        this.description = source["description"];
	        this.created = source["created"];
	    }
	}
	export class HelmHistoryInfo {
	    revision: number;
	    updated: string;
	    status: string;
	    chart: string;
	    appVersion: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new HelmHistoryInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.revision = source["revision"];
	        this.updated = source["updated"];
	        this.status = source["status"];
	        this.chart = source["chart"];
	        this.appVersion = source["appVersion"];
	        this.description = source["description"];
	    }
	}
	export class HelmInstallRequest {
	    releaseName: string;
	    namespace: string;
	    chartRef: string;
	    version: string;
	    values: Record<string, any>;
	    createNamespace: boolean;
	
	    static createFrom(source: any = {}) {
	        return new HelmInstallRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.releaseName = source["releaseName"];
	        this.namespace = source["namespace"];
	        this.chartRef = source["chartRef"];
	        this.version = source["version"];
	        this.values = source["values"];
	        this.createNamespace = source["createNamespace"];
	    }
	}
	export class HelmReleaseInfo {
	    name: string;
	    namespace: string;
	    revision: number;
	    chart: string;
	    chartVersion: string;
	    appVersion: string;
	    status: string;
	    age: string;
	    updated: string;
	    labels: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new HelmReleaseInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.revision = source["revision"];
	        this.chart = source["chart"];
	        this.chartVersion = source["chartVersion"];
	        this.appVersion = source["appVersion"];
	        this.status = source["status"];
	        this.age = source["age"];
	        this.updated = source["updated"];
	        this.labels = source["labels"];
	    }
	}
	export class HelmRepositoryInfo {
	    name: string;
	    url: string;
	
	    static createFrom(source: any = {}) {
	        return new HelmRepositoryInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.url = source["url"];
	    }
	}
	export class HelmUpgradeRequest {
	    releaseName: string;
	    namespace: string;
	    chartRef: string;
	    version: string;
	    values: Record<string, any>;
	    reuseValues: boolean;
	
	    static createFrom(source: any = {}) {
	        return new HelmUpgradeRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.releaseName = source["releaseName"];
	        this.namespace = source["namespace"];
	        this.chartRef = source["chartRef"];
	        this.version = source["version"];
	        this.values = source["values"];
	        this.reuseValues = source["reuseValues"];
	    }
	}
	export class HookConfig {
	    id: string;
	    name: string;
	    type: string;
	    scriptPath: string;
	    timeoutSeconds: number;
	    abortOnFailure: boolean;
	    enabled: boolean;
	    scope: string;
	    connectionId: string;
	    connectionType: string;
	
	    static createFrom(source: any = {}) {
	        return new HookConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.type = source["type"];
	        this.scriptPath = source["scriptPath"];
	        this.timeoutSeconds = source["timeoutSeconds"];
	        this.abortOnFailure = source["abortOnFailure"];
	        this.enabled = source["enabled"];
	        this.scope = source["scope"];
	        this.connectionId = source["connectionId"];
	        this.connectionType = source["connectionType"];
	    }
	}
	export class HookExecutionResult {
	    hookId: string;
	    hookName: string;
	    success: boolean;
	    exitCode: number;
	    stdout: string;
	    stderr: string;
	    durationMs: number;
	    timedOut: boolean;
	    error: string;
	    startedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new HookExecutionResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hookId = source["hookId"];
	        this.hookName = source["hookName"];
	        this.success = source["success"];
	        this.exitCode = source["exitCode"];
	        this.stdout = source["stdout"];
	        this.stderr = source["stderr"];
	        this.durationMs = source["durationMs"];
	        this.timedOut = source["timedOut"];
	        this.error = source["error"];
	        this.startedAt = source["startedAt"];
	    }
	}
	export class HooksConfig {
	    hooks: HookConfig[];
	
	    static createFrom(source: any = {}) {
	        return new HooksConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hooks = this.convertValues(source["hooks"], HookConfig);
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
	export class IngressTLSInfo {
	    hosts: string[];
	    secretName: string;
	
	    static createFrom(source: any = {}) {
	        return new IngressTLSInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hosts = source["hosts"];
	        this.secretName = source["secretName"];
	    }
	}
	export class IngressRule {
	    host: string;
	    path: string;
	    pathType: string;
	    serviceName: string;
	    servicePort: string;
	
	    static createFrom(source: any = {}) {
	        return new IngressRule(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.path = source["path"];
	        this.pathType = source["pathType"];
	        this.serviceName = source["serviceName"];
	        this.servicePort = source["servicePort"];
	    }
	}
	export class IngressDetail {
	    rules: IngressRule[];
	    tls: IngressTLSInfo[];
	
	    static createFrom(source: any = {}) {
	        return new IngressDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.rules = this.convertValues(source["rules"], IngressRule);
	        this.tls = this.convertValues(source["tls"], IngressTLSInfo);
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
	export class IngressInfo {
	    name: string;
	    namespace: string;
	    class: string;
	    hosts: string[];
	    address: string;
	    ports: string;
	    age: string;
	    labels: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new IngressInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.class = source["class"];
	        this.hosts = source["hosts"];
	        this.address = source["address"];
	        this.ports = source["ports"];
	        this.age = source["age"];
	        this.labels = source["labels"];
	    }
	}
	
	
	export class IngressTLSSummary {
	    hosts: string[];
	    secretName: string;
	    notBefore: string;
	    notAfter: string;
	    daysRemaining: number;
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new IngressTLSSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.hosts = source["hosts"];
	        this.secretName = source["secretName"];
	        this.notBefore = source["notBefore"];
	        this.notAfter = source["notAfter"];
	        this.daysRemaining = source["daysRemaining"];
	        this.error = source["error"];
	    }
	}
	export class JobCondition {
	    type: string;
	    status: string;
	    lastTransition: string;
	    reason: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new JobCondition(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.status = source["status"];
	        this.lastTransition = source["lastTransition"];
	        this.reason = source["reason"];
	        this.message = source["message"];
	    }
	}
	export class JobDetail {
	    pods: ResourcePodInfo[];
	    conditions: JobCondition[];
	
	    static createFrom(source: any = {}) {
	        return new JobDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pods = this.convertValues(source["pods"], ResourcePodInfo);
	        this.conditions = this.convertValues(source["conditions"], JobCondition);
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
	export class PVCConsumer {
	    podName: string;
	    node: string;
	    status: string;
	    refType?: string;
	
	    static createFrom(source: any = {}) {
	        return new PVCConsumer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.podName = source["podName"];
	        this.node = source["node"];
	        this.status = source["status"];
	        this.refType = source["refType"];
	    }
	}
	export class PersistentVolumeClaimInfo {
	    name: string;
	    namespace: string;
	    status: string;
	    volume: string;
	    capacity: string;
	    accessModes: string;
	    storageClass: string;
	    age: string;
	    labels: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new PersistentVolumeClaimInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.status = source["status"];
	        this.volume = source["volume"];
	        this.capacity = source["capacity"];
	        this.accessModes = source["accessModes"];
	        this.storageClass = source["storageClass"];
	        this.age = source["age"];
	        this.labels = source["labels"];
	    }
	}
	export class PersistentVolumeInfo {
	    name: string;
	    capacity: string;
	    accessModes: string;
	    reclaimPolicy: string;
	    status: string;
	    claim: string;
	    storageClass: string;
	    volumeType: string;
	    reason: string;
	    volumeMode: string;
	    age: string;
	    labels: Record<string, string>;
	    annotations: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new PersistentVolumeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.capacity = source["capacity"];
	        this.accessModes = source["accessModes"];
	        this.reclaimPolicy = source["reclaimPolicy"];
	        this.status = source["status"];
	        this.claim = source["claim"];
	        this.storageClass = source["storageClass"];
	        this.volumeType = source["volumeType"];
	        this.reason = source["reason"];
	        this.volumeMode = source["volumeMode"];
	        this.age = source["age"];
	        this.labels = source["labels"];
	        this.annotations = source["annotations"];
	    }
	}
	export class PodFileContent {
	    path: string;
	    base64: string;
	    size: number;
	    truncated: boolean;
	    isBinary: boolean;
	
	    static createFrom(source: any = {}) {
	        return new PodFileContent(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.base64 = source["base64"];
	        this.size = source["size"];
	        this.truncated = source["truncated"];
	        this.isBinary = source["isBinary"];
	    }
	}
	export class PodFileEntry {
	    name: string;
	    path: string;
	    isDir: boolean;
	    size: number;
	    mode?: string;
	    modified?: string;
	    created?: number;
	    isSymlink?: boolean;
	    linkTarget?: string;
	
	    static createFrom(source: any = {}) {
	        return new PodFileEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.path = source["path"];
	        this.isDir = source["isDir"];
	        this.size = source["size"];
	        this.mode = source["mode"];
	        this.modified = source["modified"];
	        this.created = source["created"];
	        this.isSymlink = source["isSymlink"];
	        this.linkTarget = source["linkTarget"];
	    }
	}
	export class PodInfo {
	    name: string;
	    namespace: string;
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
	        this.namespace = source["namespace"];
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
	export class ProxyConfig {
	    url: string;
	    authType: string;
	    username: string;
	
	    static createFrom(source: any = {}) {
	        return new ProxyConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.url = source["url"];
	        this.authType = source["authType"];
	        this.username = source["username"];
	    }
	}
	export class ReplicaSetDetail {
	    pods: ResourcePodInfo[];
	    ownerName: string;
	    ownerKind: string;
	
	    static createFrom(source: any = {}) {
	        return new ReplicaSetDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pods = this.convertValues(source["pods"], ResourcePodInfo);
	        this.ownerName = source["ownerName"];
	        this.ownerKind = source["ownerKind"];
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
	export class ReplicaSetInfo {
	    name: string;
	    namespace: string;
	    replicas: number;
	    ready: number;
	    age: string;
	    image: string;
	    labels: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new ReplicaSetInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.replicas = source["replicas"];
	        this.ready = source["ready"];
	        this.age = source["age"];
	        this.image = source["image"];
	        this.labels = source["labels"];
	    }
	}
	export class ResourceCounts {
	    podStatus: PodStatusCounts;
	    deployments: number;
	    jobs: number;
	    cronjobs: number;
	    daemonsets: number;
	    statefulsets: number;
	    replicasets: number;
	    configmaps: number;
	    secrets: number;
	    ingresses: number;
	    persistentvolumeclaims: number;
	    persistentvolumes: number;
	    helmreleases: number;
	
	    static createFrom(source: any = {}) {
	        return new ResourceCounts(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.podStatus = this.convertValues(source["podStatus"], PodStatusCounts);
	        this.deployments = source["deployments"];
	        this.jobs = source["jobs"];
	        this.cronjobs = source["cronjobs"];
	        this.daemonsets = source["daemonsets"];
	        this.statefulsets = source["statefulsets"];
	        this.replicasets = source["replicasets"];
	        this.configmaps = source["configmaps"];
	        this.secrets = source["secrets"];
	        this.ingresses = source["ingresses"];
	        this.persistentvolumeclaims = source["persistentvolumeclaims"];
	        this.persistentvolumes = source["persistentvolumes"];
	        this.helmreleases = source["helmreleases"];
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
	
	
	export class SecretConsumer {
	    kind: string;
	    name: string;
	    namespace: string;
	    refType?: string;
	
	    static createFrom(source: any = {}) {
	        return new SecretConsumer(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.kind = source["kind"];
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.refType = source["refType"];
	    }
	}
	export class SecretDataInfo {
	    key: string;
	    value: string;
	    size: number;
	    isBinary: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SecretDataInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.key = source["key"];
	        this.value = source["value"];
	        this.size = source["size"];
	        this.isBinary = source["isBinary"];
	    }
	}
	export class ServiceSummary {
	    name: string;
	    namespace: string;
	    type: string;
	    clusterIP: string;
	
	    static createFrom(source: any = {}) {
	        return new ServiceSummary(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.type = source["type"];
	        this.clusterIP = source["clusterIP"];
	    }
	}
	export class StatefulSetPVCInfo {
	    name: string;
	    namespace: string;
	    status: string;
	    capacity: string;
	    accessModes: string;
	    storageClass: string;
	    age: string;
	    podName: string;
	
	    static createFrom(source: any = {}) {
	        return new StatefulSetPVCInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.status = source["status"];
	        this.capacity = source["capacity"];
	        this.accessModes = source["accessModes"];
	        this.storageClass = source["storageClass"];
	        this.age = source["age"];
	        this.podName = source["podName"];
	    }
	}
	export class StatefulSetDetail {
	    pods: ResourcePodInfo[];
	    pvcs: StatefulSetPVCInfo[];
	
	    static createFrom(source: any = {}) {
	        return new StatefulSetDetail(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.pods = this.convertValues(source["pods"], ResourcePodInfo);
	        this.pvcs = this.convertValues(source["pvcs"], StatefulSetPVCInfo);
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
	export class StatefulSetInfo {
	    name: string;
	    namespace: string;
	    replicas: number;
	    ready: number;
	    age: string;
	    image: string;
	    labels: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new StatefulSetInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.namespace = source["namespace"];
	        this.replicas = source["replicas"];
	        this.ready = source["ready"];
	        this.age = source["age"];
	        this.image = source["image"];
	        this.labels = source["labels"];
	    }
	}
	

}

export namespace docker {
	
	export class CreateNetworkOptions {
	    Scope: string;
	    Attachable: boolean;
	    Internal: boolean;
	    Labels: Record<string, string>;
	    Subnet: string;
	    Gateway: string;
	
	    static createFrom(source: any = {}) {
	        return new CreateNetworkOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Scope = source["Scope"];
	        this.Attachable = source["Attachable"];
	        this.Internal = source["Internal"];
	        this.Labels = source["Labels"];
	        this.Subnet = source["Subnet"];
	        this.Gateway = source["Gateway"];
	    }
	}
	export class SwarmPortInfo {
	    protocol: string;
	    targetPort: number;
	    publishedPort: number;
	    publishMode: string;
	
	    static createFrom(source: any = {}) {
	        return new SwarmPortInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.protocol = source["protocol"];
	        this.targetPort = source["targetPort"];
	        this.publishedPort = source["publishedPort"];
	        this.publishMode = source["publishMode"];
	    }
	}
	export class CreateServiceOptions {
	    name: string;
	    image: string;
	    mode: string;
	    replicas: number;
	    labels: Record<string, string>;
	    env: Record<string, string>;
	    ports: SwarmPortInfo[];
	
	    static createFrom(source: any = {}) {
	        return new CreateServiceOptions(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.image = source["image"];
	        this.mode = source["mode"];
	        this.replicas = source["replicas"];
	        this.labels = source["labels"];
	        this.env = source["env"];
	        this.ports = this.convertValues(source["ports"], SwarmPortInfo);
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
	export class DockerConfig {
	    host: string;
	    tlsEnabled: boolean;
	    tlsCert: string;
	    tlsKey: string;
	    tlsCA: string;
	    tlsVerify: boolean;
	
	    static createFrom(source: any = {}) {
	        return new DockerConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.tlsEnabled = source["tlsEnabled"];
	        this.tlsCert = source["tlsCert"];
	        this.tlsKey = source["tlsKey"];
	        this.tlsCA = source["tlsCA"];
	        this.tlsVerify = source["tlsVerify"];
	    }
	}
	export class DockerConnectionStatus {
	    connected: boolean;
	    swarmActive: boolean;
	    nodeId: string;
	    isManager: boolean;
	    serverVersion: string;
	    error: string;
	
	    static createFrom(source: any = {}) {
	        return new DockerConnectionStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.connected = source["connected"];
	        this.swarmActive = source["swarmActive"];
	        this.nodeId = source["nodeId"];
	        this.isManager = source["isManager"];
	        this.serverVersion = source["serverVersion"];
	        this.error = source["error"];
	    }
	}
	export class PruneSwarmVolumesResult {
	    volumesDeleted: string[];
	    spaceReclaimed: number;
	
	    static createFrom(source: any = {}) {
	        return new PruneSwarmVolumesResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.volumesDeleted = source["volumesDeleted"];
	        this.spaceReclaimed = source["spaceReclaimed"];
	    }
	}
	export class SwarmConfigInfo {
	    id: string;
	    name: string;
	    createdAt: string;
	    updatedAt: string;
	    dataSize: number;
	    labels: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new SwarmConfigInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	        this.dataSize = source["dataSize"];
	        this.labels = source["labels"];
	    }
	}
	export class SwarmServiceRef {
	    serviceId: string;
	    serviceName: string;
	
	    static createFrom(source: any = {}) {
	        return new SwarmServiceRef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.serviceId = source["serviceId"];
	        this.serviceName = source["serviceName"];
	    }
	}
	export class SwarmConfigUpdateResult {
	    oldConfigId: string;
	    oldConfigName: string;
	    newConfigId: string;
	    newConfigName: string;
	    updated: SwarmServiceRef[];
	
	    static createFrom(source: any = {}) {
	        return new SwarmConfigUpdateResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.oldConfigId = source["oldConfigId"];
	        this.oldConfigName = source["oldConfigName"];
	        this.newConfigId = source["newConfigId"];
	        this.newConfigName = source["newConfigName"];
	        this.updated = this.convertValues(source["updated"], SwarmServiceRef);
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
	export class SwarmMountInfo {
	    type: string;
	    source: string;
	    target: string;
	    readOnly: boolean;
	
	    static createFrom(source: any = {}) {
	        return new SwarmMountInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.type = source["type"];
	        this.source = source["source"];
	        this.target = source["target"];
	        this.readOnly = source["readOnly"];
	    }
	}
	export class SwarmNetworkIPAMConfig {
	    subnet: string;
	    gateway: string;
	    ipRange: string;
	    auxAddresses: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new SwarmNetworkIPAMConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.subnet = source["subnet"];
	        this.gateway = source["gateway"];
	        this.ipRange = source["ipRange"];
	        this.auxAddresses = source["auxAddresses"];
	    }
	}
	export class SwarmNetworkInfo {
	    id: string;
	    name: string;
	    driver: string;
	    scope: string;
	    attachable: boolean;
	    internal: boolean;
	    labels: Record<string, string>;
	    options: Record<string, string>;
	    ipam: SwarmNetworkIPAMConfig[];
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new SwarmNetworkInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.driver = source["driver"];
	        this.scope = source["scope"];
	        this.attachable = source["attachable"];
	        this.internal = source["internal"];
	        this.labels = source["labels"];
	        this.options = source["options"];
	        this.ipam = this.convertValues(source["ipam"], SwarmNetworkIPAMConfig);
	        this.createdAt = source["createdAt"];
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
	export class SwarmTLSInfo {
	    trustRoot: string;
	    certIssuerSubject: string;
	    certIssuerPublicKey: string;
	
	    static createFrom(source: any = {}) {
	        return new SwarmTLSInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.trustRoot = source["trustRoot"];
	        this.certIssuerSubject = source["certIssuerSubject"];
	        this.certIssuerPublicKey = source["certIssuerPublicKey"];
	    }
	}
	export class SwarmNodeInfo {
	    id: string;
	    hostname: string;
	    role: string;
	    availability: string;
	    state: string;
	    address: string;
	    engineVersion: string;
	    os: string;
	    arch: string;
	    nanoCpus: number;
	    memoryBytes: number;
	    labels: Record<string, string>;
	    leader: boolean;
	    tls?: SwarmTLSInfo;
	
	    static createFrom(source: any = {}) {
	        return new SwarmNodeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.hostname = source["hostname"];
	        this.role = source["role"];
	        this.availability = source["availability"];
	        this.state = source["state"];
	        this.address = source["address"];
	        this.engineVersion = source["engineVersion"];
	        this.os = source["os"];
	        this.arch = source["arch"];
	        this.nanoCpus = source["nanoCpus"];
	        this.memoryBytes = source["memoryBytes"];
	        this.labels = source["labels"];
	        this.leader = source["leader"];
	        this.tls = this.convertValues(source["tls"], SwarmTLSInfo);
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
	export class SwarmPlacementInfo {
	    constraints: string[];
	    preferences: string[];
	    maxReplicas: number;
	
	    static createFrom(source: any = {}) {
	        return new SwarmPlacementInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.constraints = source["constraints"];
	        this.preferences = source["preferences"];
	        this.maxReplicas = source["maxReplicas"];
	    }
	}
	
	export class SwarmResourceCounts {
	    services: number;
	    tasks: number;
	    nodes: number;
	    networks: number;
	    configs: number;
	    secrets: number;
	    stacks: number;
	    volumes: number;
	
	    static createFrom(source: any = {}) {
	        return new SwarmResourceCounts(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.services = source["services"];
	        this.tasks = source["tasks"];
	        this.nodes = source["nodes"];
	        this.networks = source["networks"];
	        this.configs = source["configs"];
	        this.secrets = source["secrets"];
	        this.stacks = source["stacks"];
	        this.volumes = source["volumes"];
	    }
	}
	export class SwarmResourceLimitsInfo {
	    nanoCpus: number;
	    memoryBytes: number;
	
	    static createFrom(source: any = {}) {
	        return new SwarmResourceLimitsInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.nanoCpus = source["nanoCpus"];
	        this.memoryBytes = source["memoryBytes"];
	    }
	}
	export class SwarmResourcesInfo {
	    limits?: SwarmResourceLimitsInfo;
	    reservations?: SwarmResourceLimitsInfo;
	
	    static createFrom(source: any = {}) {
	        return new SwarmResourcesInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.limits = this.convertValues(source["limits"], SwarmResourceLimitsInfo);
	        this.reservations = this.convertValues(source["reservations"], SwarmResourceLimitsInfo);
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
	export class SwarmSecretInfo {
	    id: string;
	    name: string;
	    createdAt: string;
	    updatedAt: string;
	    labels: Record<string, string>;
	    driverName: string;
	    driverOptions: Record<string, string>;
	
	    static createFrom(source: any = {}) {
	        return new SwarmSecretInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
	        this.labels = source["labels"];
	        this.driverName = source["driverName"];
	        this.driverOptions = source["driverOptions"];
	    }
	}
	export class SwarmSecretUpdateResult {
	    oldSecretId: string;
	    oldSecretName: string;
	    newSecretId: string;
	    newSecretName: string;
	    updated: SwarmServiceRef[];
	
	    static createFrom(source: any = {}) {
	        return new SwarmSecretUpdateResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.oldSecretId = source["oldSecretId"];
	        this.oldSecretName = source["oldSecretName"];
	        this.newSecretId = source["newSecretId"];
	        this.newSecretName = source["newSecretName"];
	        this.updated = this.convertValues(source["updated"], SwarmServiceRef);
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
	export class SwarmUpdateConfigInfo {
	    parallelism: number;
	    delay: string;
	    failureAction: string;
	    monitor: string;
	    maxFailureRatio: number;
	    order: string;
	
	    static createFrom(source: any = {}) {
	        return new SwarmUpdateConfigInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.parallelism = source["parallelism"];
	        this.delay = source["delay"];
	        this.failureAction = source["failureAction"];
	        this.monitor = source["monitor"];
	        this.maxFailureRatio = source["maxFailureRatio"];
	        this.order = source["order"];
	    }
	}
	export class SwarmServiceInfo {
	    id: string;
	    name: string;
	    image: string;
	    replicas: number;
	    runningTasks: number;
	    mode: string;
	    ports: SwarmPortInfo[];
	    env: string[];
	    mounts: SwarmMountInfo[];
	    updateConfig?: SwarmUpdateConfigInfo;
	    resources?: SwarmResourcesInfo;
	    placement?: SwarmPlacementInfo;
	    labels: Record<string, string>;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new SwarmServiceInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.image = source["image"];
	        this.replicas = source["replicas"];
	        this.runningTasks = source["runningTasks"];
	        this.mode = source["mode"];
	        this.ports = this.convertValues(source["ports"], SwarmPortInfo);
	        this.env = source["env"];
	        this.mounts = this.convertValues(source["mounts"], SwarmMountInfo);
	        this.updateConfig = this.convertValues(source["updateConfig"], SwarmUpdateConfigInfo);
	        this.resources = this.convertValues(source["resources"], SwarmResourcesInfo);
	        this.placement = this.convertValues(source["placement"], SwarmPlacementInfo);
	        this.labels = source["labels"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
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
	
	export class SwarmStackInfo {
	    name: string;
	    services: number;
	    orchestrator: string;
	
	    static createFrom(source: any = {}) {
	        return new SwarmStackInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.services = source["services"];
	        this.orchestrator = source["orchestrator"];
	    }
	}
	export class SwarmVolumeInfo {
	    name: string;
	    driver: string;
	    scope: string;
	    mountpoint: string;
	    labels: Record<string, string>;
	    createdAt: string;
	
	    static createFrom(source: any = {}) {
	        return new SwarmVolumeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.driver = source["driver"];
	        this.scope = source["scope"];
	        this.mountpoint = source["mountpoint"];
	        this.labels = source["labels"];
	        this.createdAt = source["createdAt"];
	    }
	}
	export class SwarmStackResources {
	    networks: SwarmNetworkInfo[];
	    volumes: SwarmVolumeInfo[];
	    configs: SwarmConfigInfo[];
	    secrets: SwarmSecretInfo[];
	
	    static createFrom(source: any = {}) {
	        return new SwarmStackResources(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.networks = this.convertValues(source["networks"], SwarmNetworkInfo);
	        this.volumes = this.convertValues(source["volumes"], SwarmVolumeInfo);
	        this.configs = this.convertValues(source["configs"], SwarmConfigInfo);
	        this.secrets = this.convertValues(source["secrets"], SwarmSecretInfo);
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
	
	export class SwarmTaskNetworkInfo {
	    networkId: string;
	    addresses: string[];
	
	    static createFrom(source: any = {}) {
	        return new SwarmTaskNetworkInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.networkId = source["networkId"];
	        this.addresses = source["addresses"];
	    }
	}
	export class SwarmTaskInfo {
	    id: string;
	    serviceId: string;
	    serviceName: string;
	    nodeId: string;
	    nodeName: string;
	    slot: number;
	    state: string;
	    desiredState: string;
	    containerId: string;
	    image: string;
	    mounts: SwarmMountInfo[];
	    networks: SwarmTaskNetworkInfo[];
	    error: string;
	    createdAt: string;
	    updatedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new SwarmTaskInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.serviceId = source["serviceId"];
	        this.serviceName = source["serviceName"];
	        this.nodeId = source["nodeId"];
	        this.nodeName = source["nodeName"];
	        this.slot = source["slot"];
	        this.state = source["state"];
	        this.desiredState = source["desiredState"];
	        this.containerId = source["containerId"];
	        this.image = source["image"];
	        this.mounts = this.convertValues(source["mounts"], SwarmMountInfo);
	        this.networks = this.convertValues(source["networks"], SwarmTaskNetworkInfo);
	        this.error = source["error"];
	        this.createdAt = source["createdAt"];
	        this.updatedAt = source["updatedAt"];
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
	
	

}

export namespace jobs {
	
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
	    labels: Record<string, string>;
	
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
	        this.labels = source["labels"];
	    }
	}

}

