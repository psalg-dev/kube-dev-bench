---
mode: agent
---
# Task: Proxy support
Add support for HTTP and HTTPS proxies in the application. The app should be able to detect and use system-wide proxy settings as well as allow users to configure custom proxy settings within the app.

Proxy support should be visible on the connection wizard where users set up their kubeconfig connections. If a proxy connection is active, there should be an indicator in the footer bar. 

## Testing
Go code and frontend code should be unit tested.
The feature should also be covered by end-to-end tests using Playwright.

## Agent Instructions
Think carefully about how to implement proxy support in a Wails.io application. Consider the best practices for handling HTTP and HTTPS proxies in Go applications, as well as how to expose these settings in the Wails frontend.

Keep iterating on the implementation until proxy support is fully functional and tested. Solve this on your own. Keep your responses concise and focused on the task.

Make sure to follow CLAUDE.md