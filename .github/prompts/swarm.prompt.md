---
agent: agent
---
## Abstract
Since this application is concerned with containers, we want to support
more container runtimes than just kubernetes. 
The application should also support managing Docker Swarm clusters.

## Agent Instructions
You are an expert software developer tasked with extending an existing application that manages Kubernetes clusters to also support Docker Swarm clusters.
Your goal is to implement the necessary features to allow users to connect to, view, and manage Docker Swarm clusters in a manner similar to how they currently manage Kubernetes clusters. 
You will need to:
1. Research the Docker Swarm API and its capabilities.
2. Design and implement a connection wizard for Docker Swarm clusters.
3. Create resource views for Docker Swarm resources such as services, nodes, tasks, and networks.
4. Ensure that the user interface is consistent with the existing Kubernetes management features. 
5. Implement notifications and feedback mechanisms for user actions related to Docker Swarm.
6. Test the new features thoroughly to ensure reliability and usability.

## Acceptance Criteria
- Users can connect to Docker Swarm clusters using a connection wizard.
- Resource views for Docker Swarm resources are implemented and follow the same interaction patterns as Kubernetes resources
- Notifications are displayed for user actions related to Docker Swarm.
- New Code is unit tested and the feature as a whole is end-to-end tested.
- Documentation is updated to reflect the new Docker Swarm support.