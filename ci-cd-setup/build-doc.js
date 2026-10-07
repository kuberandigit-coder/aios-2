const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun,
  PageBreak,
} = require('docx');

// Read PNG width/height directly from the IHDR chunk (bytes 16-23) --
// no extra npm package needed, PNG format guarantees this layout.
function pngSize(file) {
  const buf = fs.readFileSync(file);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const shotsDir = path.join(__dirname, 'screenshots');
const MAX_W = 600; // docx points-ish display width, keeps every screenshot inside the page margins

const steps = [
  { file: '01_ssh-keygen-powershell-quoting-error.png', title: 'Step 1a — ssh-keygen quoting issue in PowerShell', caption: 'PowerShell swallowed the empty-passphrase argument ("-N \\"\\"") and ssh-keygen errored out. Fixed by dropping -N entirely and pressing Enter twice at the interactive passphrase prompts instead.' },
  { file: '02_pub-file-wrong-app-publisher-error.png', title: 'Step 1b — .pub file opened with the wrong app', caption: 'Windows had no default app for an extensionless/.pub file and tried Microsoft Publisher. Opened with Notepad instead to read the key.' },
  { file: '03_vps-terminal-public-key-added-confirmed.png', title: 'Step 2 — Public key added to the VPS', caption: 'Connected to the Contabo VPS and appended the new public key to ~/.ssh/authorized_keys, then confirmed with cat — the new "github-actions-deploy" key is listed.' },
  { file: '04_github-actions-create-workflow-page.png', title: 'Step 3 (navigation) — GitHub Actions "get started" page', caption: 'The default Actions landing page reached before going to Settings first for the secrets.' },
  { file: '05_github-secrets-page-empty-before.png', title: 'Step 3 — Repository secrets page (before)', caption: 'Settings > Secrets and variables > Actions, before any of the 4 deploy secrets were added.' },
  { file: '06_github-secrets-all-4-added-confirmed.png', title: 'Step 3 — All 4 secrets added', caption: 'VPS_HOST, VPS_SSH_KEY, VPS_SSH_PORT, and VPS_USER all confirmed present in the repository secrets list.' },
  { file: '07_workflow-yaml-editor-before-commit.png', title: 'Step 4 — Workflow YAML in the GitHub editor', caption: 'deploy.yml created directly in GitHub\'s web editor under .github/workflows/, triggered on push to main, running the existing deploy.sh over SSH via the appleboy/ssh-action.' },
  { file: '08_commit-changes-dialog-commit-to-main.png', title: 'Step 4 — Committing the workflow file', caption: 'Commit dialog, committing deploy.yml directly to the main branch.' },
  { file: '09_deploy-yml-committed-confirmed.png', title: 'Step 4 — deploy.yml committed', caption: 'The file now exists in .github/workflows/ on main.' },
  { file: '10_first-deploy-run-success-green-check.png', title: 'Step 5 — First automatic deploy run: SUCCESS', caption: 'The commit that added the workflow was itself a push to main, so it immediately triggered the very first automated run — green check, completed in 19 seconds. CI/CD is live: every future merge to main now deploys automatically.' },
  { file: '11_vps-journalctl-service-restart-confirmed.png', title: 'Step 5 (verification) — Confirmed on the VPS itself', caption: 'journalctl -u dm-dashboard -n 20 --no-pager on the server shows the real sequence: old process stopped (08:52:57), service restarted, new process started and serving live traffic seconds later. This confirms the automated run genuinely redeployed the backend, not just a green checkmark in GitHub\'s UI.' },
];

const children = [];

children.push(
  new Paragraph({ text: 'CI/CD Setup — dm-dashboard (GitHub Actions → Contabo VPS)', heading: HeadingLevel.TITLE }),
  new Paragraph({ children: [new TextRun({ text: 'Completed 2026-10-07', italics: true, color: '666666' })] }),
  new Paragraph({ text: '' }),
  new Paragraph({
    children: [new TextRun(
      'This document records the full setup of automatic deployment for dm-dashboard. ' +
      'Before this, deploying a change meant manually SSHing into the Contabo VPS and running ' +
      '/var/www/dashboard-dm/deploy.sh by hand after every merge to main. Now, GitHub Actions runs ' +
      'that exact same script automatically the moment something is merged into main -- nothing about ' +
      'the deploy itself changed, only who presses the button.'
    )],
  }),
  new Paragraph({ text: '' }),
  new Paragraph({ children: [new TextRun({ text: 'The live, always-current reference for how this works day to day lives in the codebase itself: docs/CI-CD-SETUP.md in the dm-dashboard repo. This document is the setup record/evidence trail, not the thing to keep updated going forward.', italics: true })] }),
  new Paragraph({ text: '' }),
  new Paragraph({ children: [new TextRun({ text: 'What was set up', bold: true })] }),
  new Paragraph({ text: '1. A dedicated SSH key pair, generated just for GitHub Actions (not reusing any personal key).' }),
  new Paragraph({ text: '2. The public half of that key added to the VPS\'s authorized_keys.' }),
  new Paragraph({ text: '3. The private half, plus the VPS host/user/port, stored as 4 encrypted GitHub repository secrets -- never committed to the repo itself.' }),
  new Paragraph({ text: '4. A GitHub Actions workflow (.github/workflows/deploy.yml) that triggers on every push to main and SSHes in to run the existing deploy.sh.' }),
  new Paragraph({ text: '5. Verified end-to-end with a real run -- the commit that added the workflow itself triggered the first successful automated deploy, confirmed both in GitHub\'s UI and directly on the VPS via journalctl.' }),
  new Paragraph({ text: '' }),
  new Paragraph({ children: [new TextRun({ text: 'Security note', bold: true })] }),
  new Paragraph({ children: [new TextRun(
    'The private SSH key itself is intentionally not included anywhere in this document, the AIOS ' +
    'repository, or any other git-tracked location -- it lives only in GitHub\'s encrypted Secrets store ' +
    'and the VPS\'s own authorized_keys file.'
  )]}),
  new Paragraph({ children: [new PageBreak()] }),
);

for (const step of steps) {
  const file = path.join(shotsDir, step.file);
  const { width, height } = pngSize(file);
  const dispW = Math.min(MAX_W, width);
  const dispH = Math.round(dispW * (height / width));

  children.push(
    new Paragraph({ text: step.title, heading: HeadingLevel.HEADING_2 }),
    new Paragraph({
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(file), transformation: { width: dispW, height: dispH } })],
    }),
    new Paragraph({ children: [new TextRun({ text: step.caption, italics: true, size: 20, color: '555555' })] }),
    new Paragraph({ text: '' }),
  );
}

const doc = new Document({
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 } } }, // US Letter
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  const target = path.join(__dirname, 'CI-CD-Setup-dm-dashboard.docx');
  fs.writeFileSync(target, buf);
  console.log('Written: CI-CD-Setup-dm-dashboard.docx');
});
