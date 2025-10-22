---
mode: agent
---
# Task: End to End testing

This app should have an end to end testing setup. 
The flow should start a KinD cluster, run "wails dev" so we get a vite devserver
that exposes a web version of our wail.io app and perform playwright test againt the frontend. 
The kubeconfig of the KinD cluster need to be pased to the app for testing since that
i used for connecting to the cluster. 

## Code Organization
Keep everything e2e related in a "e2e" directory.

## Important Details
"wails dev" starts a vite server  with two ports; on port 5173 it serves static assets, 
on port 34115 it serves the app with the wails bindings. Playwright should connect to port 34115.

# Agent Instructions
Think hard about how to implement this. Caveats specific to wails.io apps may apply.
Keep iterating until we have a passing playwright test.

## Testing Flows
The following testing flows should be implemented using playwright:

### Basic app load without kubeconfigs on host
Ensure the app loads correctly and without errors when no kubeconfig is present on the host machine.
The connection wizard should be displayed with no pre-filled kubeconfig options.

### Paste Kubeconfig
On the connection wizard the user should be able to paste a valid kubeconfig into a text area.
When the user has pasted a valid kubeconfig, the app should accept it and connect to the cluster.
Verify that the app connects to the cluster and displays the main dashboard.
Change selected namespace to "test" and verify that the namespace change is reflected in the UI.

### Load Kubeconfig from File
The user should be able to load a kubeconfig from a file on disk.
Verify that the app connects to the cluster and displays the main dashboard.
Change selected namespace to "test" and verify that the namespace change is reflected in the UI.

### Select existing Kubeconfig
If a kubeconfig is already present on the host machine, the app should detect it and display it as an option in the connection wizard.
The user should be able to select an existing kubeconfig. 
Verify that the app connects to the cluster and displays the main dashboard.
Change selected namespace to "test" and verify that the namespace change is reflected in the UI.