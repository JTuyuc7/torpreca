// Scalar's documented zero-build integration: a static HTML shell that loads
// its viewer from the CDN and points it at our generated spec. Local dev tool
// only — no app data or secrets involved, just route/schema shapes.
export const docsPageHtml = `<!doctype html>
<html>
  <head>
    <title>Torpreca API Reference</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <script id="api-reference" data-url="/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;
