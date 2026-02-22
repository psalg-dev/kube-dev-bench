---
agent: agent
---
## Task description
refactor the startup window where we currently  show the connection wizard. it should have the same layout and look and feel like the main app view. 
in the sidebar, render entries for "kubernetes" and "docker swarm"
the entries should show the number of either found kubeconfigs (for kubernetes) or the number of swarm connections (for docker swarm). the main app view should contain a section for kubernetes, listing kube configs. and it should contain a section for docker swarm, listing automatically detected docker swarm connections (like from localhost). 
in both sections, there should be a plus button, allowing for create of kubeconfig / manually specifying a swarm connection. 
elements from these sections should be pinnable. if pinned, they should show up in the sidebar under "connections"

## Features
- the connection wizard uses the same layout as the main app view
- the connection wizard sidebar shows entries for "kubernetes" and "docker swarm", with counts of found connections
- the main app view shows sections for kubernetes and docker swarm, listing found connections
- both sections have a plus button for adding new connections
- connections can be pinned from these sections, and show up in the sidebar when pinned
- for individual connections, proxy settings can be configured
- All end to end tests are updated so they work with the new connection wizard layout and user flow

## Acceptance criteria
- the connection wizard visually matches the main app view layout
- the sidebar correctly shows "kubernetes" and "docker swarm" entries with accurate counts
- both sections in the main app view list found connections and have functional plus buttons
- pinned connections appear in the sidebar under "connections"
- Acceptance criteria are verified through end-to-end tests
- Code changes and new code are covered by unit tests with at least 70% coverage

## Agent Instructions
Keep iterating on your own until all acceptance criteria are met.
Refer to the existing code structure for guidance on where to implement these changes. Ensure that you maintain consistency with the current design patterns and coding conventions used in the project. Make sure to test your changes thoroughly and update any relevant documentation to reflect the new functionality.