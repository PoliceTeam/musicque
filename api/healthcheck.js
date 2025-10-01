const http = require("http");

const options = {
  hostname: "localhost",
  port: process.env.PORT || 5000,
  path: "/api/health",
  method: "GET",
  timeout: 2000,
};

const healthCheck = http.request(options, (res) => {
  console.log(`HEALTHCHECK STATUS: ${res.statusCode}`);

  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

healthCheck.on("error", (err) => {
  console.error("HEALTHCHECK ERROR:", err.message);
  process.exit(1);
});

healthCheck.on("timeout", () => {
  console.error("HEALTHCHECK TIMEOUT");
  healthCheck.destroy();
  process.exit(1);
});

healthCheck.end();
