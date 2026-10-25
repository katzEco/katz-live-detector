// ponytail: zero-dep SSE build script using native Bun.build cross-compilation
const input = process.argv[2]?.replace(/^--arch=|^--/, "") || process.arch;
const archs = input === "all" ? ["x64", "arm64"] : [input];

for (const arch of archs) {
  if (arch !== "x64" && arch !== "arm64") {
    console.error(
      `Error: target must be Linux x64 or arm64 only. Received "${arch}".`,
    );
    process.exit(1);
  }

  const outfile = `dist/katz-live-linux-${arch}`;
  const target = `bun-linux-${arch}` as const;

  console.log(`Building Linux SSE binary for ${target}...`);
  const result = await Bun.build({
    entrypoints: ["src/index.ts"],
    compile: {
      target,
      outfile,
    },
    minify: true,
  });

  if (!result.success) {
    console.error(`Build failed for ${arch}:`, result.logs);
    process.exit(1);
  }

  console.log(`Built: ${outfile}`);
}
