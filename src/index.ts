import "dotenv/config";
import { dbConnect } from "./config/mongo";
import { createApp } from "./app";
import { startVideoJobSweeper } from "./services/video.service";

const port = process.env.PORT || 8100;

async function main() {
  await dbConnect();

  const { app, server } = createApp();

  startVideoJobSweeper();

  server.timeout = 10 * 60 * 1000;

  server.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

main();
