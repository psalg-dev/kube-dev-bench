---
agent: agent
---
The application should offer a button to "scale":
- deployments
- statefulsets
- daemon sets
- any other k8s resource which creates replicas. 

when clicking the "scale" button, an inline number control should appear
prepopulated with the current number of replicas of the selected k8s resource. 

the "scale" button should be visible in the action bar in the bottom panel
when selecting suitable k8s resources. 

think hard about how to implement this. keep code edits concise. 
code should be tested with unit tests, the feature should be tested with an e2e test.
keep iterating until we have passing unit tests and e2e test for this feature on all suitable k8s resources.