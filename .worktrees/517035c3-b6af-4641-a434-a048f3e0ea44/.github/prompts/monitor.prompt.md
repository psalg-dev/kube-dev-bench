---
mode: agent
---

# Task: Monitoring
The app should monitor k8s resources for warnings and errors.
We want to show the user a small "Warnings" and "Errors" Badge with a counter in the bottom left corner of the app
in the footer. The badges should have no rounded corners and be colored yellow for warnings and red for errors.
Badge counters should update in real-time as new warnings and errors are detected.
Clicking on the badge should open a bottom panel that shows details about the warnings and errors.

## Warning and Error Panel
The panel should slide up from the bottom when a badge is clicked and slide down when closed. The footer shiould remain visible when the panel is open. Like other panels in the app, it should have a drag handle at the top center for easy dragging.
The panel should have two tabs: "Warnings" and "Errors". Each tab should display a list of the respective issues.

## Warning and Error details
We want to show as much useful information as possible about each warning and error so a user can quickly understand and address the issue. Each warning and error item in the list should include:
- A timestamp of when the issue was detected
- The namespace and name of the affected resource
- A full description of the issue
- The full path from where the error occurred