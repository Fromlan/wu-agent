$ErrorActionPreference = 'Stop'
$wuRoot = Split-Path -Parent $PSScriptRoot
$wuRevision = '5d5dd754ebc1948e977ddb880a9eb5aa25f37b4c'
$wuWork = Join-Path $wuRoot ('.wu-agent\chat-demo-build\' + [Guid]::NewGuid().ToString('N'))
New-Item -Path $wuWork -ItemType Directory | Out-Null
$wuArchive = Join-Path $wuWork 'source.zip'
$wuSource = Join-Path $wuWork ('chat-demo-' + $wuRevision)
node --input-type=module -e "import {writeFile} from 'node:fs/promises'; const response = await fetch(process.argv[1]); if (!response.ok) throw new Error('GitHub download failed: ' + response.status); await writeFile(process.argv[2], Buffer.from(await response.arrayBuffer()));" "https://codeload.github.com/deepseek-ai/chat-demo/zip/$wuRevision" $wuArchive
if ($LASTEXITCODE -ne 0) { throw 'Chat Demo source download failed' }
Expand-Archive -LiteralPath $wuArchive -DestinationPath $wuWork
node (Join-Path $PSScriptRoot 'patch-chat-demo.mjs') $wuSource
if ($LASTEXITCODE -ne 0) { throw 'Chat Demo patch failed' }
pnpm --dir $wuSource install --frozen-lockfile --ignore-scripts --store-dir (Join-Path $wuRoot '.wu-agent\chat-demo-build\pnpm-store')
if ($LASTEXITCODE -ne 0) { throw 'Chat Demo dependencies could not be installed' }
$wuOldMode = $env:NODE_ENV
try {
    $env:NODE_ENV = 'production'
    pnpm --dir $wuSource exec rspack build -c rspack.config.ts
    if ($LASTEXITCODE -ne 0) { throw 'Chat Demo build failed' }
} finally {
    $env:NODE_ENV = $wuOldMode
}
node (Join-Path $PSScriptRoot 'package-chat-demo.mjs') $wuSource (Join-Path $wuRoot 'public\chat-demo') $wuRevision
if ($LASTEXITCODE -ne 0) { throw 'Chat Demo packaging failed' }
