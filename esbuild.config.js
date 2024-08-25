let makeAllPackagesExternalPlugin = {
  name: "make-all-packages-external",
  setup(build) {
    let filter = /^[^.\/]|^\.[^.\/]|^\.\.[^\/]/;
    build.onResolve({ filter }, (args) => ({
      path: args.path,
      external: true,
    }));
  },
};

require("esbuild").build({
  entryPoints: ["server.js"],
  bundle: true,
  minify: true,
  platform: "node",
  outdir: "dist",
  plugins: [makeAllPackagesExternalPlugin],
});
