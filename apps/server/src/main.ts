import { buildApp } from "./create-app.js";

const app = buildApp();
const port = Number(process.env.PORT ?? 3000);

app.listen({ host: "0.0.0.0", port }, (error) => {
  if (error) {
    app.log.error(error);
    process.exit(1);
  }

  app.log.info(`Server running on port ${port}`);
});
