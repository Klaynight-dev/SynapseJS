import { runDomBench } from "./dom-bench";

runDomBench().catch((error) => {
  console.error("DOM benchmark failed:", error);
});
