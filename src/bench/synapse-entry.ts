import { createSynapseBench } from "./synapse-bench";

createSynapseBench().catch((error) => {
  console.error("Synapse benchmark failed:", error);
});
