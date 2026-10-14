// Sincroniza o código-fonte do receitahub para a pasta do receitahub-institucional.
//
// As duas pastas têm o mesmo código e, copiando arquivo por arquivo na mão, elas
// já divergiram (cartões de /planos, textos, correções). Esta é a fonte única:
// edite SEMPRE o receitahub e rode `npm run sync:institucional`.
//
// Uso:
//   npm run sync:institucional              # copia para ../receitahub-institucional
//   npm run sync:institucional -- --dry     # só mostra o que mudaria
//   npm run sync:institucional -- <caminho> # outro destino
//
// Copia: src, public, supabase, tests, scripts. NÃO copia: .env*, .git, .output,
// node_modules, lockfiles, package.json, README e arquivos de governança do
// institucional (CODE_OF_CONDUCT, CONTRIBUTING, .github...), que são só dele.
// Arquivos gerados (routeTree.gen.ts, supabase/.temp) também ficam de fora.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const target = resolve(
  args.find((a) => !a.startsWith("--")) ?? join(root, "..", "receitahub-institucional"),
);

if (!existsSync(target)) {
  console.error(`Destino não encontrado: ${target}`);
  process.exit(1);
}

const DIRS = ["src", "public", "supabase", "tests", "scripts"];
const SKIP = new Set(["routeTree.gen.ts", ".temp", "node_modules", ".output", ".git"]);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else yield full;
  }
}

let changed = 0;
for (const d of DIRS) {
  const from = join(root, d);
  if (!existsSync(from)) continue;
  for (const file of walk(from)) {
    const rel = relative(root, file);
    const dest = join(target, rel);
    const same = existsSync(dest) && readFileSync(dest).equals(readFileSync(file));
    if (same) continue;
    changed++;
    console.log(`${existsSync(dest) ? "atualiza" : "novo    "}  ${rel}`);
    if (!dry) {
      mkdirSync(dirname(dest), { recursive: true });
      cpSync(file, dest);
    }
  }
}

// package.json: só os scripts de teste/sync, sem mexer em dependências do institucional
const pkgFrom = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const pkgToPath = join(target, "package.json");
if (existsSync(pkgToPath)) {
  const pkgTo = JSON.parse(readFileSync(pkgToPath, "utf8"));
  let pkgChanged = false;
  for (const k of ["test", "sync:institucional"]) {
    if (pkgTo.scripts?.[k] !== pkgFrom.scripts?.[k]) {
      pkgTo.scripts = { ...pkgTo.scripts, [k]: pkgFrom.scripts[k] };
      pkgChanged = true;
    }
  }
  if (pkgChanged) {
    changed++;
    console.log("atualiza  package.json (scripts)");
    if (!dry) writeFileSync(pkgToPath, JSON.stringify(pkgTo, null, 2) + "\n");
  }
}

console.log(
  changed === 0
    ? "Nada a sincronizar: as pastas já estão iguais."
    : `${dry ? "Mudaria" : "Sincronizado"}: ${changed} arquivo(s). Destino: ${target}`,
);
