package app

import (
	"testing"
	"time"

	appsv1 "k8s.io/api/apps/v1"
	autoscalingv2 "k8s.io/api/autoscaling/v2"
	corev1 "k8s.io/api/core/v1"
	networkingv1 "k8s.io/api/networking/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// ---------------------------------------------------------------------------
// TestTruncateID
// ---------------------------------------------------------------------------

func TestTruncateID(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"abc123def456xyz789", "abc123def456"},
		{"short", "short"},
		{"exactly12ch!", "exactly12ch!"},
		{"", ""},
		{"12345678901", "12345678901"},
		{"123456789012", "123456789012"},
		{"1234567890123", "123456789012"},
	}
	for _, tc := range tests {
		got := truncateID(tc.input)
		if got != tc.want {
			t.Errorf("truncateID(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

// ---------------------------------------------------------------------------
// TestGetPVVolumeType - all volume types
// ---------------------------------------------------------------------------

func TestGetPVVolumeType(t *testing.T) {
	hostPath := "/tmp"
	tests := []struct {
		name string
		spec corev1.PersistentVolumeSpec
		want string
	}{
		{
			name: "HostPath",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					HostPath: &corev1.HostPathVolumeSource{Path: hostPath},
				},
			},
			want: "HostPath",
		},
		{
			name: "NFS",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					NFS: &corev1.NFSVolumeSource{Server: "nfs-server", Path: "/"},
				},
			},
			want: "NFS",
		},
		{
			name: "CSI",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					CSI: &corev1.CSIPersistentVolumeSource{Driver: "driver.io"},
				},
			},
			want: "CSI",
		},
		{
			name: "GCEPersistentDisk",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					GCEPersistentDisk: &corev1.GCEPersistentDiskVolumeSource{PDName: "disk"},
				},
			},
			want: "GCEPersistentDisk",
		},
		{
			name: "AzureDisk",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					AzureDisk: &corev1.AzureDiskVolumeSource{DiskName: "disk"},
				},
			},
			want: "AzureDisk",
		},
		{
			name: "CephFS",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					CephFS: &corev1.CephFSPersistentVolumeSource{Monitors: []string{"mon:6789"}},
				},
			},
			want: "CephFS",
		},
		{
			name: "ISCSI",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					ISCSI: &corev1.ISCSIPersistentVolumeSource{TargetPortal: "10.0.0.1:3260", IQN: "iqn"},
				},
			},
			want: "ISCSI",
		},
		{
			name: "RBD",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					RBD: &corev1.RBDPersistentVolumeSource{CephMonitors: []string{"mon"}, RBDImage: "img"},
				},
			},
			want: "RBD",
		},
		{
			name: "Local",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					Local: &corev1.LocalVolumeSource{Path: "/mnt/disks/vol1"},
				},
			},
			want: "Local",
		},
		{
			name: "FC",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					FC: &corev1.FCVolumeSource{},
				},
			},
			want: "FC",
		},
		{
			name: "Flocker",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					Flocker: &corev1.FlockerVolumeSource{},
				},
			},
			want: "Flocker",
		},
		{
			name: "Glusterfs",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					Glusterfs: &corev1.GlusterfsPersistentVolumeSource{EndpointsName: "ep", Path: "vol"},
				},
			},
			want: "Glusterfs",
		},
		{
			name: "PortworxVolume",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					PortworxVolume: &corev1.PortworxVolumeSource{VolumeID: "vol"},
				},
			},
			want: "PortworxVolume",
		},
		{
			name: "Quobyte",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					Quobyte: &corev1.QuobyteVolumeSource{Registry: "registry", Volume: "vol"},
				},
			},
			want: "Quobyte",
		},
		{
			name: "StorageOS",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					StorageOS: &corev1.StorageOSPersistentVolumeSource{},
				},
			},
			want: "StorageOS",
		},
		{
			name: "VsphereVolume",
			spec: corev1.PersistentVolumeSpec{
				PersistentVolumeSource: corev1.PersistentVolumeSource{
					VsphereVolume: &corev1.VsphereVirtualDiskVolumeSource{VolumePath: "/path"},
				},
			},
			want: "VsphereVolume",
		},
		{
			name: "default (unknown)",
			spec: corev1.PersistentVolumeSpec{},
			want: "-",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := getPVVolumeType(&tc.spec)
			if got != tc.want {
				t.Errorf("getPVVolumeType() = %q, want %q", got, tc.want)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// TestFormatHPAMetricStatus
// ---------------------------------------------------------------------------

func TestFormatHPAMetricStatus(t *testing.T) {
	t.Run("average utilization", func(t *testing.T) {
		util := int32(65)
		got := formatHPAMetricStatus(autoscalingv2.MetricValueStatus{AverageUtilization: &util})
		if got != "65%" {
			t.Errorf("expected 65%%, got %q", got)
		}
	})

	t.Run("empty returns empty string", func(t *testing.T) {
		got := formatHPAMetricStatus(autoscalingv2.MetricValueStatus{})
		if got != "" {
			t.Errorf("expected empty string, got %q", got)
		}
	})
}

// ---------------------------------------------------------------------------
// TestBuildDeploymentConditions
// ---------------------------------------------------------------------------

func TestBuildDeploymentConditions(t *testing.T) {
	t.Run("empty conditions", func(t *testing.T) {
		got := buildDeploymentConditions(nil)
		if len(got) != 0 {
			t.Errorf("expected empty slice, got %d", len(got))
		}
	})

	t.Run("single condition with zero time", func(t *testing.T) {
		conds := []appsv1.DeploymentCondition{
			{
				Type:    appsv1.DeploymentAvailable,
				Status:  corev1.ConditionTrue,
				Reason:  "MinimumReplicasAvailable",
				Message: "Deployment has minimum availability.",
			},
		}
		got := buildDeploymentConditions(conds)
		if len(got) != 1 {
			t.Fatalf("expected 1, got %d", len(got))
		}
		if got[0].LastTransition != "-" {
			t.Errorf("expected '-' for zero time, got %q", got[0].LastTransition)
		}
		if got[0].Reason != "MinimumReplicasAvailable" {
			t.Errorf("Reason=%q, want MinimumReplicasAvailable", got[0].Reason)
		}
	})

	t.Run("condition with non-zero time", func(t *testing.T) {
		ts := metav1.NewTime(time.Now())
		conds := []appsv1.DeploymentCondition{
			{
				Type:               appsv1.DeploymentProgressing,
				Status:             corev1.ConditionFalse,
				LastTransitionTime: ts,
			},
		}
		got := buildDeploymentConditions(conds)
		if len(got) != 1 {
			t.Fatalf("expected 1, got %d", len(got))
		}
		if got[0].LastTransition == "-" {
			t.Error("expected non-zero time string, got '-'")
		}
	})

	t.Run("multiple conditions", func(t *testing.T) {
		conds := []appsv1.DeploymentCondition{
			{Type: appsv1.DeploymentAvailable, Status: corev1.ConditionTrue},
			{Type: appsv1.DeploymentProgressing, Status: corev1.ConditionFalse},
		}
		got := buildDeploymentConditions(conds)
		if len(got) != 2 {
			t.Fatalf("expected 2, got %d", len(got))
		}
	})
}

// ---------------------------------------------------------------------------
// TestGetIngressPathType and TestGetIngressBackendInfo
// ---------------------------------------------------------------------------

func TestGetIngressPathType(t *testing.T) {
	t.Run("nil returns Prefix", func(t *testing.T) {
		got := getIngressPathType(nil)
		if got != "Prefix" {
			t.Errorf("expected Prefix, got %q", got)
		}
	})

	t.Run("Exact type", func(t *testing.T) {
		pt := networkingv1.PathTypeExact
		got := getIngressPathType(&pt)
		if got != "Exact" {
			t.Errorf("expected Exact, got %q", got)
		}
	})

	t.Run("Prefix type", func(t *testing.T) {
		pt := networkingv1.PathTypePrefix
		got := getIngressPathType(&pt)
		if got != "Prefix" {
			t.Errorf("expected Prefix, got %q", got)
		}
	})
}

func TestGetIngressBackendInfo(t *testing.T) {
	t.Run("nil service returns empty", func(t *testing.T) {
		svcName, svcPort := getIngressBackendInfo(networkingv1.IngressBackend{})
		if svcName != "" || svcPort != "" {
			t.Errorf("expected empty, got name=%q port=%q", svcName, svcPort)
		}
	})

	t.Run("service with port number", func(t *testing.T) {
		backend := networkingv1.IngressBackend{
			Service: &networkingv1.IngressServiceBackend{
				Name: "my-svc",
				Port: networkingv1.ServiceBackendPort{Number: 8080},
			},
		}
		name, port := getIngressBackendInfo(backend)
		if name != "my-svc" {
			t.Errorf("name=%q, want my-svc", name)
		}
		if port != "8080" {
			t.Errorf("port=%q, want 8080", port)
		}
	})

	t.Run("service with port name", func(t *testing.T) {
		backend := networkingv1.IngressBackend{
			Service: &networkingv1.IngressServiceBackend{
				Name: "api-svc",
				Port: networkingv1.ServiceBackendPort{Name: "http"},
			},
		}
		name, port := getIngressBackendInfo(backend)
		if name != "api-svc" {
			t.Errorf("name=%q, want api-svc", name)
		}
		if port != "http" {
			t.Errorf("port=%q, want http", port)
		}
	})
}

// ---------------------------------------------------------------------------
// TestFormatAccessModes_ResourceDetails
// ---------------------------------------------------------------------------

func TestFormatAccessModes_ResourceDetails(t *testing.T) {
	t.Run("empty modes", func(t *testing.T) {
		got := formatAccessModes(nil)
		if got != "" {
			t.Errorf("expected empty, got %q", got)
		}
	})

	t.Run("single mode", func(t *testing.T) {
		got := formatAccessModes([]corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce})
		if got != "ReadWriteOnce" {
			t.Errorf("expected ReadWriteOnce, got %q", got)
		}
	})

	t.Run("multiple modes", func(t *testing.T) {
		got := formatAccessModes([]corev1.PersistentVolumeAccessMode{
			corev1.ReadWriteOnce,
			corev1.ReadOnlyMany,
		})
		if got != "ReadWriteOnce, ReadOnlyMany" {
			t.Errorf("expected 'ReadWriteOnce, ReadOnlyMany', got %q", got)
		}
	})
}
