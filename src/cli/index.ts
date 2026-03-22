import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { specCommand } from "./commands/spec.js";
import { designCommand } from "./commands/design.js";
import { validateCommand } from "./commands/validate.js";
import { lintCommand } from "./commands/lint.js";
import { gateCommand } from "./commands/gate.js";
import { traceCommand } from "./commands/trace.js";
import { diffCommand } from "./commands/diff.js";
import { statusCommand } from "./commands/status.js";
import { generateCommand } from "./commands/generate.js";
import { auditCommand } from "./commands/audit.js";

const program = new Command();

program
  .name("spectra")
  .description(
    "SPECTRA — Spec-Driven Development with Composable Traceability and Reconciliation"
  )
  .version("0.1.0");

program.addCommand(initCommand);
program.addCommand(specCommand);
program.addCommand(designCommand);
program.addCommand(validateCommand);
program.addCommand(lintCommand);
program.addCommand(gateCommand);
program.addCommand(traceCommand);
program.addCommand(diffCommand);
program.addCommand(statusCommand);
program.addCommand(generateCommand);
program.addCommand(auditCommand);

program.parse();
