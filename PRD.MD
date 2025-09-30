# gowails Product Requirements Document

## gowails Overview
This application is a kubernetes client, looking to offer a competitive set of features to existing clients. Its target
audience is developers and devops engineers or anyone who needs to interact with kubernetes clusters on a regular basis.

## gowails Stack
- Frontend: React
- Backend: Go
- Application Framework: Wails (https://wails.io/)

## gowails Development
- IDE: JetBrains Intellij IDEA
- Console: MINGW64

## Features
- Connection Wizard
  - Identifies kubeconfigs in User's home directory 
  - Allows user to add new kubeconfig files
  - Allows user to select a kubeconfig file
  - Allows user to switch between multiple kubeconfig files
- Pod Overview
  - Lists all pods in the selected namespace
  - Allows user to filter pods 
  - Allows user to sort pods by name, status, age
  - Allows user to view pod details (name, namespace, status, age, labels, annotations, containers)
  - Allows user to view pod logs
  - Allows user to view pod events
  - Allows user to delete a pod
  - Allows user to restart a pod
  - Allows user to exec into a pod
  - Allows user to port-forward a pod
  - Allows user to view pod metrics (CPU, Memory)
  - Allows user to view pod YAML
  - Allows user to create a resource (pod, deployment, service, etc.)
