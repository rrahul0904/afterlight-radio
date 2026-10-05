import fs from 'node:fs';
import path from 'node:path';

const manifestPath = process.env.REVERSE_ENGINEERING_OS_MANIFEST || 'reverse-engineering-os/project.json';
const absoluteManifest = path.resolve(process.cwd(), manifestPath);
const fail = (message) => {
  console.error(`Reverse Engineering OS gate: FAIL\n${message}`);
  process.exit(1);
};

if (!fs.existsSync(absoluteManifest)) fail(`Missing manifest: ${manifestPath}`);

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(absoluteManifest, 'utf8'));
} catch (error) {
  fail(`Manifest is not valid JSON: ${error.message}`);
}

const requiredStages = [
  'discover', 'understand', 'analyze', 'reconstruct', 'architect',
  'implement', 'execute', 'test', 'uat', 'build', 'deploy', 'compare', 'prove'
];
const allowedStatuses = new Set(['passed', 'partial', 'blocked', 'pending']);
const allowedClassifications = new Set(['MATCH', 'IMPROVE', 'NEW', 'OMIT', 'INVESTIGATE']);
const problems = [];

if (manifest.schemaVersion !== '1.0') problems.push('schemaVersion must be 1.0');
if (!manifest.project?.name) problems.push('project.name is required');
if (!manifest.project?.repository) problems.push('project.repository is required');
if (!manifest.productThesis || manifest.productThesis.length < 40) problems.push('productThesis must describe the product, not just name it');
if (!Array.isArray(manifest.canonicalSources) || manifest.canonicalSources.length === 0) problems.push('at least one canonical source is required');
if (!Array.isArray(manifest.primaryWorkflow) || manifest.primaryWorkflow.length < 3) problems.push('primaryWorkflow must contain at least three steps');
if (!Array.isArray(manifest.capabilities) || manifest.capabilities.length === 0) problems.push('capability matrix is required');
if (!manifest.nextAction) problems.push('nextAction is required');

for (const capability of manifest.capabilities || []) {
  if (!capability.name) problems.push('every capability requires a name');
  if (!allowedClassifications.has(capability.classification)) problems.push(`invalid capability classification: ${capability.classification}`);
  if (!capability.status) problems.push(`capability ${capability.name || '<unknown>'} requires status`);
}

for (const stage of requiredStages) {
  const record = manifest.stages?.[stage];
  if (!record) {
    problems.push(`missing stage: ${stage}`);
    continue;
  }
  if (!allowedStatuses.has(record.status)) problems.push(`invalid status for ${stage}: ${record.status}`);
  if (record.status === 'passed' && (!Array.isArray(record.evidence) || record.evidence.length === 0)) {
    problems.push(`passed stage ${stage} requires evidence`);
  }
  for (const evidence of record.evidence || []) {
    if (!evidence.kind || !evidence.ref) problems.push(`stage ${stage} contains malformed evidence`);
    if (evidence.kind === 'path' && !fs.existsSync(path.resolve(process.cwd(), evidence.ref))) {
      problems.push(`stage ${stage} references missing repository evidence: ${evidence.ref}`);
    }
  }
}

const completionStages = manifest.completionGate?.requiredPassedStages || requiredStages;
const notPassed = completionStages.filter((stage) => manifest.stages?.[stage]?.status !== 'passed');
if (manifest.project?.status === 'COMPLETE' && notPassed.length > 0) {
  problems.push(`false COMPLETE claim; unresolved stages: ${notPassed.join(', ')}`);
}

if (!requiredStages.includes(manifest.project?.currentStage)) {
  problems.push(`project.currentStage must be one of: ${requiredStages.join(', ')}`);
}

if (problems.length) fail(problems.map((item) => `- ${item}`).join('\n'));

console.log('Reverse Engineering OS gate: PASS');
console.log(`Project: ${manifest.project.name}`);
console.log(`Status: ${manifest.project.status}`);
console.log(`Current stage: ${manifest.project.currentStage}`);
console.log(`Incomplete completion gates: ${notPassed.length ? notPassed.join(', ') : 'none'}`);
console.log(`Next action: ${manifest.nextAction}`);
