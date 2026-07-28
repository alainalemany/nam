# Checkpoint D Private Validator Recovery

Status: Confirmed incident-specific recovery procedure.

This runbook completes only the structural-validation portion of Checkpoint D
D6.4 after the Windows `HTMLFile` COM parser failed to preserve the HTML5
`section` ancestry in an already downloaded Day View response. The failure is a
parser compatibility defect, not an established application failure.

This procedure supplements the authoritative
[Checkpoint D Application Deployment Correction](checkpoint-d-application-deployment-correction.md).
It does not replace or reopen any successful D6.4 transport check.

## Scope And Stop Conditions

Use this procedure only for the sealed Darnassus evidence identified below.
The two private HTTPS requests have already passed and **must not be repeated**.
Do not run `curl.exe`, Tailscale, DNS, SSH, SCP, deployment, Compose, Docker, or
rollback commands while executing this recovery.

Stop fail-closed if any required identity, checksum, size, repository, WSL,
validator, or collision check differs. Preserve every file already created in
the continuation root. Do not classify D6.4 complete and do not begin D6.5.
Rollback is not automatic and remains not required for the known parser
compatibility defect.

## Fixed Incident Evidence

| Item | Required value |
| --- | --- |
| Pre-correction control commit | `58f374a018792f16ab30cfd548000d5b20a6b3da` |
| Application-source identity | `76cdba9530e49334e775009a811ae5ae74305c65` |
| Device | `DARNASSUS` |
| WSL distribution | `AlmaLinux-9` |
| WSL Python entry point | `/usr/bin/python3` |
| WSL Python version | `3.9.25` |
| Sealed request-evidence root | `C:\Users\alain\nam-deployment-evidence\checkpoint-d-76cdba9530e4-20260728T015759Z` |
| Sealed checksum manifest | `C:\Users\alain\nam-deployment-evidence\checkpoint-d-76cdba9530e4-20260728T015759Z\SHA256SUMS.txt` |
| Sealed checksum-manifest SHA-256 | `15DF1ED5DC0964E472F41B7D7EE28FA3ADE213DD03254FA255AE448E78FCBBC1` |
| Files recorded by the sealed manifest | `13` |
| Original Day View HTML | `C:\Users\alain\nam-deployment-evidence\checkpoint-d-76cdba9530e4-20260728T015759Z\d6-private-day-view.html` |
| Original Day View HTML SHA-256 | `d2c27440483c8b6a676009034f95bcdce52616ec1b96a1ec34ff34c8c7c5ed8c` |
| Original Day View HTML size | `26805` bytes |
| Authoritative D4.5 validator SHA-256 | `4f784c56a4d9f1ab01b04ffb2ba017d0c9ee58a17df3b1be712ca30c0f4d4173` |
| Required validator result | `DAY_VIEW_STRUCTURE=PASS mode=candidate panels=10` |

The sealed root, its checksum manifest, the downloaded HTML, the incomplete
summary, and the parser-compatibility evidence are immutable historical
evidence. The continuation root is a new sibling beneath
`C:\Users\alain\nam-deployment-evidence`; it is never a child of the sealed
root.

## Recovery Gates

The procedure has eight fail-closed gates:

1. **R1 — Control and collision gate:** require a new full runbook-control
   commit that is the direct, single-parent, non-merge child of the
   pre-correction commit, clean synchronized `main`, the exact four-path
   correction status set, and a new empty sibling continuation root.
2. **R2 — Sealed evidence gate:** verify the fixed checksum-manifest hash
   before relying on it, strictly parse its exact 13 entries, and require the
   sealed root's exact 14-entry immediate inventory.
3. **R3 — Recorded transport gate:** validate the retained request summaries
   and exact health body without making a request.
4. **R4 — WSL capability and parity gate:** invoke the real
   `/usr/bin/python3` in local `AlmaLinux-9` and require WSL to observe the same
   original HTML hash and size.
5. **R5 — Structural authority gate:** extract the uniquely bounded, fixed-hash
   D4.5 validator from the approved runbook-control commit.
6. **R6 — Syntax and structural gate:** run a no-bytecode `ast.parse` preflight,
   then and only then run the validator in `candidate` mode. Both native
   commands require zero exit status, empty stderr, and their exact stdout
   contracts.
7. **R7 — Continuation sealing gate:** write a non-final gate record, close the
   transcript in `finally`, create a checksum manifest over the exact
   pre-completion evidence set, strictly validate membership and every hash,
   revalidate the sealed original root, and retain the continuation manifest
   SHA-256.
8. **R8 — Final classification gate:** atomically move a same-directory
   create-new temporary record to the fixed final completion-record path with
   no clobber. That move is the final state-changing action.

Until R8, no file classifies D6.4 as PASS or permits D6.5. The validator's
required stdout contains the word `PASS`, but it is structural-result evidence,
not the D6.4 completion classification.

## Darnassus Recovery Command

The following is **one compound PowerShell command/scriptblock**. It contains
multiple ordered gates inside one `& { ... }` child scope. All variables are
created and consumed within that single scope; the procedure does not depend on
a variable created by an earlier child scriptblock remaining available.

Run it from Windows PowerShell on Darnassus only after the correction has been
reviewed, committed, and pushed. Supply the full new approved runbook-control
commit and the existing clean repository path when prompted. Do not use the old
`58f374a018792f16ab30cfd548000d5b20a6b3da` control commit.

```powershell
& {
  $ErrorActionPreference = 'Stop'
  Set-StrictMode -Version Latest

  $preCorrectionCommit = '58f374a018792f16ab30cfd548000d5b20a6b3da'
  $runbookControlCommit = (
    Read-Host 'Full new approved runbook-control commit'
  ).Trim()
  $repoRoot = [System.IO.Path]::GetFullPath(
    (Read-Host 'Existing Darnassus NAM repository path').Trim()
  )
  $evidenceParent = 'C:\Users\alain\nam-deployment-evidence'
  $sealedRoot = Join-Path $evidenceParent `
    'checkpoint-d-76cdba9530e4-20260728T015759Z'
  $sealedManifest = Join-Path $sealedRoot 'SHA256SUMS.txt'
  $originalHtml = Join-Path $sealedRoot 'd6-private-day-view.html'
  $sealedManifestHash = `
    '15DF1ED5DC0964E472F41B7D7EE28FA3ADE213DD03254FA255AE448E78FCBBC1'
  $originalHtmlHash = `
    'D2C27440483C8B6A676009034F95BCDCE52616EC1B96A1EC34FF34C8C7C5ED8C'
  $originalHtmlSize = 26805L
  $authoritativeValidatorHash = `
    '4F784C56A4D9F1AB01B04FFB2BA017D0C9EE58A17DF3B1BE712CA30C0F4D4173'
  $requiredValidatorOutput = `
    'DAY_VIEW_STRUCTURE=PASS mode=candidate panels=10'
  $expectedWslOriginalHtml = `
    '/mnt/c/Users/alain/nam-deployment-evidence/' +
    'checkpoint-d-76cdba9530e4-20260728T015759Z/' +
    'd6-private-day-view.html'

  function Invoke-GitText {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)
    $output = @(& git.exe -C $repoRoot @Arguments)
    $exitStatus = $LASTEXITCODE
    if ($exitStatus -ne 0) {
      throw "D6.4 recovery FAIL: git exit $exitStatus: $($Arguments -join ' ')"
    }
    return $output
  }

  function Invoke-NativeCapture {
    param(
      [Parameter(Mandatory = $true)][string]$FilePath,
      [Parameter(Mandatory = $true)][string[]]$Arguments
    )
    $quotedArguments = @()
    foreach ($argument in $Arguments) {
      if ($null -eq $argument -or $argument -match '["\x00\r\n]') {
        throw 'D6.4 recovery FAIL: native argument cannot be quoted safely'
      }
      $quotedArguments += '"' + $argument + '"'
    }
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $FilePath
    $startInfo.Arguments = $quotedArguments -join ' '
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    try {
      $started = $process.Start()
      if (-not $started) {
        throw "D6.4 recovery FAIL: native process did not start: $FilePath"
      }
      $stdoutTask = $process.StandardOutput.ReadToEndAsync()
      $stderrTask = $process.StandardError.ReadToEndAsync()
      $process.WaitForExit()
      $result = [pscustomobject]@{
        ExitCode = $process.ExitCode
        Stdout = $stdoutTask.Result
        Stderr = $stderrTask.Result
      }
    }
    finally {
      $process.Dispose()
    }
    return $result
  }

  function Get-ExactNativeLines {
    param([Parameter(Mandatory = $true)][string]$Text)
    $normalized = $Text.Replace("`r`n", "`n")
    if ($normalized.Contains("`r") -or -not $normalized.EndsWith("`n")) {
      throw 'D6.4 recovery FAIL: native stdout has invalid line endings'
    }
    $body = $normalized.Substring(0, $normalized.Length - 1)
    if ($body.Length -eq 0) {
      return
    }
    return $body.Split([char]"`n")
  }

  function Assert-DirectoryNoReparse {
    param([Parameter(Mandatory = $true)][string]$Path)
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    if (-not (Test-Path -LiteralPath $fullPath -PathType Container)) {
      throw "D6.4 recovery FAIL: directory is absent: $fullPath"
    }
    $item = Get-Item -Force -LiteralPath $fullPath -ErrorAction Stop
    if (
      ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
      ($item.Attributes -band [System.IO.FileAttributes]::Directory) -eq 0
    ) {
      throw "D6.4 recovery FAIL: directory is not regular: $fullPath"
    }
    return $fullPath
  }

  function Assert-RegularFileNoReparse {
    param([Parameter(Mandatory = $true)][string]$Path)
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
      throw "D6.4 recovery FAIL: required file is absent: $fullPath"
    }
    $item = Get-Item -Force -LiteralPath $fullPath -ErrorAction Stop
    if (
      ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
      ($item.Attributes -band [System.IO.FileAttributes]::Directory) -ne 0
    ) {
      throw "D6.4 recovery FAIL: file is not regular: $fullPath"
    }
    return $item
  }

  function Write-BytesNoClobber {
    param(
      [Parameter(Mandatory = $true)][string]$Path,
      [Parameter(Mandatory = $true)]
      [AllowEmptyCollection()][byte[]]$Bytes
    )
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    if (
      [System.IO.Path]::GetDirectoryName($fullPath) -ine
        $continuationRootFull
    ) {
      throw "D6.4 recovery FAIL: write escaped continuation root: $fullPath"
    }
    $stream = [System.IO.FileStream]::new(
      $fullPath,
      [System.IO.FileMode]::CreateNew,
      [System.IO.FileAccess]::Write,
      [System.IO.FileShare]::None
    )
    try {
      $stream.Write($Bytes, 0, $Bytes.Length)
      $stream.Flush($true)
    }
    finally {
      $stream.Dispose()
    }
  }

  function Write-Utf8TextNoClobber {
    param(
      [Parameter(Mandatory = $true)][string]$Path,
      [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text
    )
    $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($Text)
    Write-BytesNoClobber -Path $Path -Bytes $bytes
  }

  function Write-Utf8LinesNoClobber {
    param(
      [Parameter(Mandatory = $true)][string]$Path,
      [Parameter(Mandatory = $true)][string[]]$Lines
    )
    $text = [string]::Join([Environment]::NewLine, $Lines) +
      [Environment]::NewLine
    Write-Utf8TextNoClobber -Path $Path -Text $text
  }

  function Write-AsciiLinesNoClobber {
    param(
      [Parameter(Mandatory = $true)][string]$Path,
      [Parameter(Mandatory = $true)][string[]]$Lines
    )
    $text = [string]::Join([Environment]::NewLine, $Lines) +
      [Environment]::NewLine
    $bytes = [System.Text.Encoding]::ASCII.GetBytes($text)
    Write-BytesNoClobber -Path $Path -Bytes $bytes
  }

  function Assert-ExactRegularInventory {
    param(
      [Parameter(Mandatory = $true)][string]$Root,
      [Parameter(Mandatory = $true)][string[]]$ExpectedLeafNames
    )
    $rootFull = Assert-DirectoryNoReparse -Path $Root
    $expected = [System.Collections.Generic.HashSet[string]]::new(
      [System.StringComparer]::OrdinalIgnoreCase
    )
    foreach ($leafName in $ExpectedLeafNames) {
      if (
        [System.IO.Path]::GetFileName($leafName) -cne $leafName -or
        -not $expected.Add($leafName)
      ) {
        throw "D6.4 recovery FAIL: invalid or duplicate leaf name: $leafName"
      }
    }
    $entries = @(
      Get-ChildItem -Force -LiteralPath $rootFull -ErrorAction Stop
    )
    if ($entries.Count -ne $expected.Count) {
      throw "D6.4 recovery FAIL: exact inventory count changed: $rootFull"
    }
    $observed = [System.Collections.Generic.HashSet[string]]::new(
      [System.StringComparer]::OrdinalIgnoreCase
    )
    foreach ($entry in $entries) {
      if (
        [System.IO.Path]::GetDirectoryName(
          [System.IO.Path]::GetFullPath($entry.FullName)
        ) -ine $rootFull -or
        -not $observed.Add($entry.Name) -or
        -not $expected.Contains($entry.Name) -or
        ($entry.Attributes -band
          [System.IO.FileAttributes]::ReparsePoint) -ne 0 -or
        ($entry.Attributes -band
          [System.IO.FileAttributes]::Directory) -ne 0
      ) {
        throw "D6.4 recovery FAIL: unexpected inventory entry: $($entry.FullName)"
      }
    }
    foreach ($leafName in $ExpectedLeafNames) {
      $requiredPath = Join-Path $rootFull $leafName
      $requiredItem = Assert-RegularFileNoReparse -Path $requiredPath
      if ($requiredItem.Name -cne $leafName) {
        throw "D6.4 recovery FAIL: normalized path substitution: $requiredPath"
      }
    }
  }

  function Assert-SealedEvidence {
    $parentFull = Assert-DirectoryNoReparse -Path $evidenceParent
    $rootFull = Assert-DirectoryNoReparse -Path $sealedRoot
    if ([System.IO.Path]::GetDirectoryName($rootFull) -ine $parentFull) {
      throw 'D6.4 recovery FAIL: sealed root is not an immediate sibling root'
    }
    $manifestItem = Assert-RegularFileNoReparse -Path $sealedManifest
    if ([System.IO.Path]::GetDirectoryName($manifestItem.FullName) -ine
      $rootFull) {
      throw 'D6.4 recovery FAIL: sealed manifest escaped the sealed root'
    }

    # Authenticate the manifest bytes before parsing or trusting any entry.
    $actualManifestHash = (
      Get-FileHash -LiteralPath $manifestItem.FullName -Algorithm SHA256
    ).Hash
    if ($actualManifestHash -cne $sealedManifestHash) {
      throw 'D6.4 recovery FAIL: sealed checksum-manifest hash mismatch'
    }

    $manifestLines = @(
      Get-Content -LiteralPath $manifestItem.FullName -ErrorAction Stop
    )
    if ($manifestLines.Count -ne 13) {
      throw 'D6.4 recovery FAIL: sealed manifest does not contain 13 entries'
    }
    $recorded = [System.Collections.Generic.Dictionary[string,string]]::new(
      [System.StringComparer]::OrdinalIgnoreCase
    )
    foreach ($manifestLine in $manifestLines) {
      $lineMatch = [regex]::Match(
        $manifestLine,
        '^([0-9A-Fa-f]{64})  (.+)$'
      )
      if (-not $lineMatch.Success) {
        throw "D6.4 recovery FAIL: malformed sealed manifest line: $manifestLine"
      }
      $recordedHash = $lineMatch.Groups[1].Value.ToUpperInvariant()
      $recordedPath = [System.IO.Path]::GetFullPath(
        $lineMatch.Groups[2].Value
      )
      if (
        $lineMatch.Groups[2].Value -ine $recordedPath -or
        [System.IO.Path]::GetDirectoryName($recordedPath) -ine $rootFull -or
        $recorded.ContainsKey($recordedPath)
      ) {
        throw "D6.4 recovery FAIL: duplicate or non-immediate sealed path: $recordedPath"
      }
      $recorded.Add($recordedPath, $recordedHash)
      $recordedItem = Assert-RegularFileNoReparse -Path $recordedPath
      if ($recordedItem.FullName -ine $recordedPath) {
        throw "D6.4 recovery FAIL: normalized sealed path substitution: $recordedPath"
      }
      $observedHash = (
        Get-FileHash -LiteralPath $recordedPath -Algorithm SHA256
      ).Hash
      if ($observedHash -cne $recordedHash) {
        throw "D6.4 recovery FAIL: sealed evidence hash mismatch: $recordedPath"
      }
    }

    $expectedSealedLeaves = @(
      $recorded.Keys | ForEach-Object { [System.IO.Path]::GetFileName($_) }
    ) + 'SHA256SUMS.txt'
    Assert-ExactRegularInventory -Root $rootFull `
      -ExpectedLeafNames $expectedSealedLeaves

    $originalHtmlFull = [System.IO.Path]::GetFullPath($originalHtml)
    if (-not $recorded.ContainsKey($originalHtmlFull)) {
      throw 'D6.4 recovery FAIL: original HTML is absent from sealed manifest'
    }
    $htmlItem = Assert-RegularFileNoReparse -Path $originalHtmlFull
    $actualHtmlHash = (
      Get-FileHash -LiteralPath $htmlItem.FullName -Algorithm SHA256
    ).Hash
    if (
      $actualHtmlHash -cne $originalHtmlHash -or
      $htmlItem.Length -ne $originalHtmlSize
    ) {
      throw 'D6.4 recovery FAIL: original Day View HTML identity mismatch'
    }

    return [pscustomobject]@{
      ManifestHash = $actualManifestHash
      HtmlHash = $actualHtmlHash
      HtmlSize = $htmlItem.Length
      EntryCount = $recorded.Count
    }
  }

  function Assert-OneExactLine {
    param(
      [Parameter(Mandatory = $true)][string]$Path,
      [Parameter(Mandatory = $true)][string]$Expected
    )
    $matches = @(
      Get-Content -LiteralPath $Path -ErrorAction Stop |
        Where-Object { $_ -ceq $Expected }
    )
    if ($matches.Count -ne 1) {
      throw "D6.4 recovery FAIL: expected one exact line in $Path: $Expected"
    }
  }

  function Assert-ContinuationManifest {
    param(
      [Parameter(Mandatory = $true)][string]$ManifestPath,
      [Parameter(Mandatory = $true)][string[]]$ExpectedLeafNames
    )
    $manifestItem = Assert-RegularFileNoReparse -Path $ManifestPath
    if ([System.IO.Path]::GetDirectoryName($manifestItem.FullName) -ine
      $continuationRootFull) {
      throw 'D6.4 recovery FAIL: continuation manifest escaped its root'
    }
    $expectedPaths = [System.Collections.Generic.HashSet[string]]::new(
      [System.StringComparer]::OrdinalIgnoreCase
    )
    foreach ($leafName in $ExpectedLeafNames) {
      $expectedPath = [System.IO.Path]::GetFullPath(
        (Join-Path $continuationRootFull $leafName)
      )
      if (-not $expectedPaths.Add($expectedPath)) {
        throw "D6.4 recovery FAIL: duplicate expected continuation path: $expectedPath"
      }
    }
    $manifestLines = @(
      Get-Content -LiteralPath $manifestItem.FullName -ErrorAction Stop
    )
    $recorded = [System.Collections.Generic.Dictionary[string,string]]::new(
      [System.StringComparer]::OrdinalIgnoreCase
    )
    foreach ($manifestLine in $manifestLines) {
      $lineMatch = [regex]::Match($manifestLine, '^([0-9A-F]{64})  (.+)$')
      if (-not $lineMatch.Success) {
        throw "D6.4 recovery FAIL: malformed continuation manifest line: $manifestLine"
      }
      $recordedHash = $lineMatch.Groups[1].Value
      $recordedPath = [System.IO.Path]::GetFullPath(
        $lineMatch.Groups[2].Value
      )
      if (
        $lineMatch.Groups[2].Value -ine $recordedPath -or
        [System.IO.Path]::GetDirectoryName($recordedPath) -ine
          $continuationRootFull -or
        -not $expectedPaths.Contains($recordedPath) -or
        $recorded.ContainsKey($recordedPath)
      ) {
        throw "D6.4 recovery FAIL: duplicate or unexpected continuation path: $recordedPath"
      }
      $recorded.Add($recordedPath, $recordedHash)
      $recordedItem = Assert-RegularFileNoReparse -Path $recordedPath
      if ($recordedItem.FullName -ine $recordedPath) {
        throw "D6.4 recovery FAIL: normalized continuation path substitution: $recordedPath"
      }
      $observedHash = (
        Get-FileHash -LiteralPath $recordedPath -Algorithm SHA256
      ).Hash
      if ($observedHash -cne $recordedHash) {
        throw "D6.4 recovery FAIL: continuation hash mismatch: $recordedPath"
      }
    }
    if ($recorded.Count -ne $expectedPaths.Count) {
      throw 'D6.4 recovery FAIL: continuation manifest membership is incomplete'
    }
    foreach ($expectedPath in $expectedPaths) {
      if (-not $recorded.ContainsKey($expectedPath)) {
        throw "D6.4 recovery FAIL: continuation manifest entry is absent: $expectedPath"
      }
    }
    return [pscustomobject]@{
      Entries = $recorded
    }
  }

  function Publish-AtomicUtf8NoClobber {
    param(
      [Parameter(Mandatory = $true)][string]$FinalPath,
      [Parameter(Mandatory = $true)][string[]]$Lines
    )
    $finalFull = [System.IO.Path]::GetFullPath($FinalPath)
    if (
      [System.IO.Path]::GetDirectoryName($finalFull) -ine
        $continuationRootFull
    ) {
      throw 'D6.4 recovery FAIL: final publication escaped continuation root'
    }
    $publicationRootFull = Assert-DirectoryNoReparse `
      -Path $continuationRootFull
    if (
      $publicationRootFull -ine $continuationRootFull -or
      [System.IO.Path]::GetDirectoryName($publicationRootFull) -ine
        $evidenceParentFull
    ) {
      throw 'D6.4 recovery FAIL: continuation root identity changed before publication'
    }
    $temporaryPath = Join-Path $continuationRootFull (
      '.' + [System.IO.Path]::GetFileName($finalFull) +
      '.publishing-' + [guid]::NewGuid().ToString('N') + '.tmp'
    )
    $text = [string]::Join([Environment]::NewLine, $Lines) +
      [Environment]::NewLine
    $bytes = [System.Text.UTF8Encoding]::new($false).GetBytes($text)
    Write-BytesNoClobber -Path $temporaryPath -Bytes $bytes
    if (Test-Path -LiteralPath $finalFull) {
      throw "D6.4 recovery FAIL: final completion record exists: $finalFull"
    }
    [System.IO.File]::Move($temporaryPath, $finalFull)
  }

  # R1 — Control and collision gate.
  if ($runbookControlCommit -cnotmatch '^[0-9a-f]{40}$') {
    throw 'D6.4 recovery FAIL: control commit is not a full lowercase SHA'
  }
  if ($runbookControlCommit -ceq $preCorrectionCommit) {
    throw 'D6.4 recovery FAIL: new control commit still equals the old commit'
  }
  if (-not (Test-Path -LiteralPath $repoRoot -PathType Container)) {
    throw 'D6.4 recovery FAIL: repository path is not a directory'
  }

  $commitObject = (
    Invoke-GitText @('rev-parse', "$runbookControlCommit`^{commit}") -join ''
  ).Trim()
  $branch = (Invoke-GitText @('branch', '--show-current') -join '').Trim()
  $head = (Invoke-GitText @('rev-parse', 'HEAD') -join '').Trim()
  $localMain = (
    Invoke-GitText @('rev-parse', 'refs/heads/main') -join ''
  ).Trim()
  $localOriginMain = (
    Invoke-GitText @('rev-parse', 'refs/remotes/origin/main') -join ''
  ).Trim()
  $porcelain = @(Invoke-GitText @(
    'status',
    '--porcelain=v1',
    '--untracked-files=all'
  ))
  $remoteMainResult = @(
    Invoke-GitText @('ls-remote', 'origin', 'refs/heads/main')
  )
  if ($remoteMainResult.Count -ne 1) {
    throw 'D6.4 recovery FAIL: remote main did not resolve exactly once'
  }
  $remoteMainFields = @($remoteMainResult[0] -split '\s+')
  if (
    $commitObject -cne $runbookControlCommit -or
    $branch -cne 'main' -or
    $head -cne $runbookControlCommit -or
    $localMain -cne $runbookControlCommit -or
    $localOriginMain -cne $runbookControlCommit -or
    $remoteMainFields.Count -ne 2 -or
    $remoteMainFields[0] -cne $runbookControlCommit -or
    $remoteMainFields[1] -cne 'refs/heads/main' -or
    $porcelain.Count -ne 0
  ) {
    throw 'D6.4 recovery FAIL: main is not clean and synchronized'
  }

  & git.exe -C $repoRoot merge-base --is-ancestor `
    $preCorrectionCommit $runbookControlCommit
  $mergeBaseExit = $LASTEXITCODE
  if ($mergeBaseExit -ne 0) {
    throw 'D6.4 recovery FAIL: pre-correction commit is not an ancestor'
  }
  $parentResult = Invoke-NativeCapture -FilePath 'git.exe' -Arguments @(
    '-C',
    $repoRoot,
    'rev-list',
    '--parents',
    '-n',
    '1',
    $runbookControlCommit
  )
  if (
    $parentResult.ExitCode -ne 0 -or
    $parentResult.Stderr.Length -ne 0
  ) {
    throw 'D6.4 recovery FAIL: control commit parent query failed'
  }
  $parentLines = @(Get-ExactNativeLines -Text $parentResult.Stdout)
  if ($parentLines.Count -ne 1) {
    throw 'D6.4 recovery FAIL: control commit parent query is not one line'
  }
  $parentFields = @($parentLines[0] -split '\s+')
  if (
    $parentFields.Count -ne 2 -or
    $parentFields[0] -cne $runbookControlCommit -or
    $parentFields[1] -cne $preCorrectionCommit
  ) {
    throw 'D6.4 recovery FAIL: control commit is not the direct single-parent correction child'
  }
  $expectedCorrectionStatus = @(
    "A`tdocs/infrastructure/checkpoint-d-private-validator-recovery.md",
    "M`tdocs/README.md",
    "M`tdocs/infrastructure/checkpoint-d-application-deployment-correction.md",
    "M`tdocs/infrastructure/checkpoint-d-existing-candidate-recovery.md"
  ) | Sort-Object
  $actualCorrectionStatus = @(
    Invoke-GitText @(
      'diff',
      '--name-status',
      '--find-renames',
      '--find-copies',
      $preCorrectionCommit,
      $runbookControlCommit
    )
  ) | Sort-Object
  if ($actualCorrectionStatus.Count -ne $expectedCorrectionStatus.Count) {
    throw 'D6.4 recovery FAIL: control range path/status count is not exact'
  }
  for ($index = 0; $index -lt $expectedCorrectionStatus.Count; $index++) {
    if ($actualCorrectionStatus[$index] -cne
      $expectedCorrectionStatus[$index]) {
      throw 'D6.4 recovery FAIL: control range path/status set is not exact'
    }
  }
  $correctionSummary = @(
    Invoke-GitText @(
      'diff',
      '--summary',
      $preCorrectionCommit,
      $runbookControlCommit
    )
  )
  if (
    $correctionSummary.Count -ne 1 -or
    $correctionSummary[0].Trim() -cne
      'create mode 100644 docs/infrastructure/checkpoint-d-private-validator-recovery.md'
  ) {
    throw 'D6.4 recovery FAIL: control range has a mode or type change'
  }
  $correctionWhitespace = @(
    Invoke-GitText @(
      'diff',
      '--check',
      $preCorrectionCommit,
      $runbookControlCommit
    )
  )
  if ($correctionWhitespace.Count -ne 0) {
    throw 'D6.4 recovery FAIL: control range fails git diff --check'
  }

  $evidenceParentFull = Assert-DirectoryNoReparse -Path $evidenceParent
  $sealedRootFull = Assert-DirectoryNoReparse -Path $sealedRoot
  if ([System.IO.Path]::GetDirectoryName($sealedRootFull) -ine
    $evidenceParentFull) {
    throw 'D6.4 recovery FAIL: sealed root is outside the evidence parent'
  }
  $continuationId = 'checkpoint-d-private-validator-recovery-76cdba9530e4-' +
    [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssZ')
  $continuationRoot = Join-Path $evidenceParentFull $continuationId
  if (Test-Path -LiteralPath $continuationRoot) {
    throw 'D6.4 recovery FAIL: continuation root collision'
  }
  New-Item -ItemType Directory -Path $continuationRoot `
    -ErrorAction Stop | Out-Null
  $continuationRootFull = Assert-DirectoryNoReparse -Path $continuationRoot
  if (
    [System.IO.Path]::GetDirectoryName($continuationRootFull) -ine
      $evidenceParentFull -or
    $continuationRootFull -ieq $sealedRootFull
  ) {
    throw 'D6.4 recovery FAIL: continuation root is not a new sibling'
  }

  $preManifestLeafNames = @(
    'd6-private-validator-recovery-transcript.txt',
    'runbook-control-identity.txt',
    'original-evidence-integrity.txt',
    'original-private-request-validation.txt',
    'wsl-python-runtime.txt',
    'wsl-html-integrity.txt',
    'validate-day-view.py',
    'validator-syntax-stdout.txt',
    'validator-syntax-stderr.txt',
    'validator-syntax-native-exit-status.txt',
    'validator-stdout.txt',
    'validator-stderr.txt',
    'validator-native-exit-status.txt',
    'recovery-gates-complete.txt'
  )
  $manifestLeafName = 'SHA256SUMS.txt'
  $finalLeafName = 'd6-private-validator-completion-summary.txt'
  $reservedLeafNames = @(
    $preManifestLeafNames + $manifestLeafName + $finalLeafName
  )
  if (
    @($reservedLeafNames | Sort-Object -Unique).Count -ne
      $reservedLeafNames.Count
  ) {
    throw 'D6.4 recovery FAIL: continuation leaf-name collision'
  }
  foreach ($leafName in $reservedLeafNames) {
    $reservedPath = Join-Path $continuationRootFull $leafName
    if (Test-Path -LiteralPath $reservedPath) {
      throw "D6.4 recovery FAIL: continuation evidence exists: $reservedPath"
    }
  }

  $transcriptPath = Join-Path $continuationRootFull `
    'd6-private-validator-recovery-transcript.txt'
  $transcriptStarted = $false
  $gatesComplete = $false
  try {
    Start-Transcript -Path $transcriptPath -NoClobber `
      -ErrorAction Stop | Out-Null
    $transcriptStarted = $true

    Write-Utf8LinesNoClobber -Path (
      Join-Path $continuationRootFull 'runbook-control-identity.txt'
    ) -Lines @(
      "RUNBOOK_CONTROL_COMMIT=$runbookControlCommit",
      "PRE_CORRECTION_CONTROL_COMMIT=$preCorrectionCommit",
      'BRANCH=main',
      "HEAD=$head",
      "LOCAL_MAIN=$localMain",
      "LOCAL_ORIGIN_MAIN=$localOriginMain",
      "REMOTE_MAIN=$($remoteMainFields[0])",
      'REPOSITORY_CLEAN=YES',
      "CONTROL_PARENT_QUERY_STDOUT=$($parentLines[0])",
      'CONTROL_PARENT_QUERY_STDERR_EMPTY=YES',
      'CONTROL_PARENT_QUERY_NATIVE_EXIT_STATUS=0',
      "CONTROL_COMMIT_PARENT=$($parentFields[1])",
      'CONTROL_COMMIT_DIRECT_SINGLE_PARENT_CHILD=YES',
      'CONTROL_RANGE_STATUS_SET=EXACT',
      'CONTROL_RANGE_MODE_SET=EXACT',
      "CONTINUATION_ROOT=$continuationRootFull",
      'FINAL_CLASSIFICATION=PENDING'
    )

    # R2 — Verify the fixed manifest first, all 13 entries, and exact root set.
    $sealedState = Assert-SealedEvidence
    Write-Utf8LinesNoClobber -Path (
      Join-Path $continuationRootFull 'original-evidence-integrity.txt'
    ) -Lines @(
      "SEALED_EVIDENCE_ROOT=$sealedRootFull",
      "SEALED_CHECKSUM_MANIFEST=$sealedManifest",
      "SEALED_CHECKSUM_MANIFEST_SHA256=$($sealedState.ManifestHash)",
      'SEALED_MANIFEST_ENTRIES=13',
      "SEALED_MANIFEST_ENTRIES_VERIFIED=$($sealedState.EntryCount)",
      'SEALED_ROOT_EXACT_ENTRIES_INCLUDING_MANIFEST=14',
      "ORIGINAL_DAY_VIEW_HTML=$originalHtml",
      "WINDOWS_DAY_VIEW_SHA256=$($sealedState.HtmlHash)",
      "WINDOWS_DAY_VIEW_SIZE=$($sealedState.HtmlSize)",
      'ORIGINAL_EVIDENCE_MUTATED=NO',
      'FINAL_CLASSIFICATION=PENDING'
    )

    # R3 — These are authenticated file reads, not HTTPS requests.
    $healthSummary = Join-Path $sealedRootFull `
      'd6-private-health.request-summary.txt'
    $daySummary = Join-Path $sealedRootFull `
      'd6-private-day-view.request-summary.txt'
    $healthBody = Join-Path $sealedRootFull 'd6-private-health.json'
    Assert-OneExactLine $healthSummary 'curl_native_exit_status=0'
    Assert-OneExactLine $healthSummary 'http_code=200'
    Assert-OneExactLine $healthSummary `
      'effective_url=https://ops-console.tailf57e61.ts.net/api/health'
    Assert-OneExactLine $healthSummary 'remote_ip=100.98.215.31'
    Assert-OneExactLine $healthSummary 'redirect_count=0'
    Assert-OneExactLine $healthSummary 'redirect_url='
    Assert-OneExactLine $healthSummary 'tls_verification_result=0'
    Assert-OneExactLine $daySummary 'curl_native_exit_status=0'
    Assert-OneExactLine $daySummary 'http_code=200'
    Assert-OneExactLine $daySummary `
      'effective_url=https://ops-console.tailf57e61.ts.net/day-view'
    Assert-OneExactLine $daySummary 'remote_ip=100.98.215.31'
    Assert-OneExactLine $daySummary 'redirect_count=0'
    Assert-OneExactLine $daySummary 'redirect_url='
    Assert-OneExactLine $daySummary 'tls_verification_result=0'
    $health = Get-Content -Raw -LiteralPath $healthBody `
      -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
    $healthKeys = @($health.PSObject.Properties.Name | Sort-Object)
    if (
      $healthKeys.Count -ne 2 -or
      $healthKeys[0] -cne 'database' -or
      $healthKeys[1] -cne 'status' -or
      $health.database -cne 'ok' -or
      $health.status -cne 'ok'
    ) {
      throw 'D6.4 recovery FAIL: retained private health body is not exact'
    }
    Write-Utf8LinesNoClobber -Path (
      Join-Path $continuationRootFull `
        'original-private-request-validation.txt'
    ) -Lines @(
      'HTTPS_REQUESTS_REPEATED=NO',
      'PRIVATE_HEALTH_TRANSPORT_VERIFIED=YES',
      'PRIVATE_HEALTH_HTTP=200',
      'PRIVATE_HEALTH_REMOTE_IP=100.98.215.31',
      'PRIVATE_HEALTH_REDIRECTS=0',
      'PRIVATE_HEALTH_TLS_VERIFIED=YES',
      'PRIVATE_HEALTH_SCHEMA_VERIFIED=YES',
      'PRIVATE_DAY_VIEW_TRANSPORT_VERIFIED=YES',
      'PRIVATE_DAY_VIEW_HTTP=200',
      'PRIVATE_DAY_VIEW_REMOTE_IP=100.98.215.31',
      'PRIVATE_DAY_VIEW_REDIRECTS=0',
      'PRIVATE_DAY_VIEW_TLS_VERIFIED=YES',
      'FINAL_CLASSIFICATION=PENDING'
    )

    # R4 — Capture WSL streams in memory; publish fixed files only by create-new.
    $pythonProbe = Invoke-NativeCapture -FilePath 'wsl.exe' -Arguments @(
      '-d',
      'AlmaLinux-9',
      '--',
      '/usr/bin/python3',
      '-B',
      '-c',
      'import os,platform,sys; print(sys.executable); print(platform.python_version()); print(os.path.realpath(sys.executable))'
    )
    $pythonProbeLines = @(Get-ExactNativeLines -Text $pythonProbe.Stdout)
    if (
      $pythonProbe.ExitCode -ne 0 -or
      $pythonProbe.Stderr.Length -ne 0 -or
      $pythonProbeLines.Count -ne 3 -or
      $pythonProbeLines[0] -cne '/usr/bin/python3' -or
      $pythonProbeLines[1] -cne '3.9.25' -or
      [string]::IsNullOrWhiteSpace($pythonProbeLines[2])
    ) {
      throw 'D6.4 recovery FAIL: AlmaLinux-9 /usr/bin/python3 probe failed'
    }
    Write-Utf8LinesNoClobber -Path (
      Join-Path $continuationRootFull 'wsl-python-runtime.txt'
    ) -Lines @(
      'WSL_DISTRIBUTION=AlmaLinux-9',
      'PYTHON_ENTRY_POINT=/usr/bin/python3',
      "PYTHON_VERSION=$($pythonProbeLines[1])",
      "PYTHON_REAL_PATH=$($pythonProbeLines[2])",
      "PYTHON_NATIVE_EXIT_STATUS=$($pythonProbe.ExitCode)",
      'PYTHON_STDERR_EMPTY=YES',
      'PYTHON_RUNTIME_VERIFIED=YES',
      'FINAL_CLASSIFICATION=PENDING'
    )

    $wslOriginalPathResult = Invoke-NativeCapture `
      -FilePath 'wsl.exe' -Arguments @(
        '-d',
        'AlmaLinux-9',
        '--',
        '/usr/bin/wslpath',
        '-a',
        '-u',
        $originalHtml
      )
    $wslOriginalPathLines = @(
      Get-ExactNativeLines -Text $wslOriginalPathResult.Stdout
    )
    if (
      $wslOriginalPathResult.ExitCode -ne 0 -or
      $wslOriginalPathResult.Stderr.Length -ne 0 -or
      $wslOriginalPathLines.Count -ne 1 -or
      $wslOriginalPathLines[0] -cne $expectedWslOriginalHtml
    ) {
      throw 'D6.4 recovery FAIL: original Windows-to-WSL path is not exact'
    }
    $wslOriginalHtml = $wslOriginalPathLines[0]
    $wslHtmlProbe = Invoke-NativeCapture -FilePath 'wsl.exe' -Arguments @(
      '-d',
      'AlmaLinux-9',
      '--',
      '/usr/bin/python3',
      '-B',
      '-c',
      'import hashlib,pathlib,sys; p=pathlib.Path(sys.argv[1]); b=p.read_bytes(); print(hashlib.sha256(b).hexdigest()); print(len(b))',
      $wslOriginalHtml
    )
    $wslHtmlLines = @(Get-ExactNativeLines -Text $wslHtmlProbe.Stdout)
    if (
      $wslHtmlProbe.ExitCode -ne 0 -or
      $wslHtmlProbe.Stderr.Length -ne 0 -or
      $wslHtmlLines.Count -ne 2 -or
      $wslHtmlLines[0].ToUpperInvariant() -cne $originalHtmlHash -or
      $wslHtmlLines[1] -cne "$originalHtmlSize"
    ) {
      throw 'D6.4 recovery FAIL: WSL HTML hash or size differs from Windows'
    }
    Write-Utf8LinesNoClobber -Path (
      Join-Path $continuationRootFull 'wsl-html-integrity.txt'
    ) -Lines @(
      "WSL_DAY_VIEW_PATH=$wslOriginalHtml",
      "WSL_DAY_VIEW_SHA256=$($wslHtmlLines[0])",
      "WSL_DAY_VIEW_SIZE=$($wslHtmlLines[1])",
      "WINDOWS_DAY_VIEW_SHA256=$($sealedState.HtmlHash)",
      "WINDOWS_DAY_VIEW_SIZE=$($sealedState.HtmlSize)",
      "WSL_NATIVE_EXIT_STATUS=$($wslHtmlProbe.ExitCode)",
      'WSL_STDERR_EMPTY=YES',
      'WINDOWS_WSL_HTML_PARITY_VERIFIED=YES',
      'FINAL_CLASSIFICATION=PENDING'
    )

    # R5 — Extract the uniquely bounded D4.5 source from the approved commit.
    $runbookPath = `
      'docs/infrastructure/checkpoint-d-application-deployment-correction.md'
    $runbookLines = @(
      Invoke-GitText @('show', "$runbookControlCommit`:$runbookPath")
    )
    $validatorMarker = 'tee "$NAM_D_DAY_VIEW_VALIDATOR" >/dev/null <<''PY'''
    $markerIndexes = @()
    for ($index = 0; $index -lt $runbookLines.Count; $index++) {
      if ($runbookLines[$index] -ceq $validatorMarker) {
        $markerIndexes += $index
      }
    }
    if (
      $markerIndexes.Count -ne 1 -or
      $markerIndexes[0] -lt 2 -or
      $runbookLines[$markerIndexes[0] - 2] -cne '```bash' -or
      $runbookLines[$markerIndexes[0] - 1] -cne
        'export NAM_D_DAY_VIEW_VALIDATOR="$NAM_D_EXECUTION_ROOT/evidence/validate-day-view.py"'
    ) {
      throw 'D6.4 recovery FAIL: authoritative validator marker is not unique'
    }
    $closingFence = -1
    for (
      $index = $markerIndexes[0] + 1;
      $index -lt $runbookLines.Count;
      $index++
    ) {
      if ($runbookLines[$index] -ceq '```') {
        $closingFence = $index
        break
      }
    }
    if ($closingFence -le ($markerIndexes[0] + 2)) {
      throw 'D6.4 recovery FAIL: authoritative validator fence is malformed'
    }
    $terminatorIndexes = @()
    for (
      $index = $markerIndexes[0] + 1;
      $index -lt $closingFence;
      $index++
    ) {
      if ($runbookLines[$index] -ceq 'PY') {
        $terminatorIndexes += $index
      }
    }
    if (
      $terminatorIndexes.Count -ne 1 -or
      $terminatorIndexes[0] -le ($markerIndexes[0] + 1)
    ) {
      throw 'D6.4 recovery FAIL: authoritative validator terminator is not exact'
    }
    $validatorStart = $markerIndexes[0] + 1
    $validatorEnd = $terminatorIndexes[0]
    $validatorSource = (
      $runbookLines[$validatorStart..($validatorEnd - 1)] -join "`n"
    ) + "`n"
    if ([string]::IsNullOrWhiteSpace($validatorSource)) {
      throw 'D6.4 recovery FAIL: authoritative validator extraction is empty'
    }
    $validatorPath = Join-Path $continuationRootFull 'validate-day-view.py'
    Write-Utf8TextNoClobber -Path $validatorPath -Text $validatorSource
    $validatorHash = (
      Get-FileHash -LiteralPath $validatorPath -Algorithm SHA256
    ).Hash
    if ($validatorHash -cne $authoritativeValidatorHash) {
      throw 'D6.4 recovery FAIL: authoritative validator source hash differs'
    }

    $wslContinuationPathResult = Invoke-NativeCapture `
      -FilePath 'wsl.exe' -Arguments @(
        '-d',
        'AlmaLinux-9',
        '--',
        '/usr/bin/wslpath',
        '-a',
        '-u',
        $continuationRootFull
      )
    $wslContinuationLines = @(
      Get-ExactNativeLines -Text $wslContinuationPathResult.Stdout
    )
    if (
      $wslContinuationPathResult.ExitCode -ne 0 -or
      $wslContinuationPathResult.Stderr.Length -ne 0 -or
      $wslContinuationLines.Count -ne 1 -or
      [string]::IsNullOrWhiteSpace($wslContinuationLines[0]) -or
      -not $wslContinuationLines[0].StartsWith('/mnt/c/')
    ) {
      throw 'D6.4 recovery FAIL: continuation WSL path conversion failed'
    }
    $wslValidatorPath = (
      $wslContinuationLines[0].TrimEnd('/') + '/validate-day-view.py'
    )

    # R6 — Syntax preflight must succeed before candidate execution begins.
    $syntaxValidatorItem = Assert-RegularFileNoReparse -Path $validatorPath
    if (
      $syntaxValidatorItem.FullName -ine
        [System.IO.Path]::GetFullPath($validatorPath) -or
      (Get-FileHash -LiteralPath $syntaxValidatorItem.FullName `
        -Algorithm SHA256).Hash -cne $validatorHash -or
      $validatorHash -cne $authoritativeValidatorHash
    ) {
      throw 'D6.4 recovery FAIL: validator identity changed before syntax preflight'
    }
    $syntaxResult = Invoke-NativeCapture -FilePath 'wsl.exe' -Arguments @(
      '-d',
      'AlmaLinux-9',
      '--',
      '/usr/bin/python3',
      '-B',
      '-c',
      'import ast,pathlib,sys; p=pathlib.Path(sys.argv[1]); ast.parse(p.read_text(encoding=''utf-8''), filename=str(p))',
      $wslValidatorPath
    )
    Write-Utf8TextNoClobber -Path (
      Join-Path $continuationRootFull 'validator-syntax-stdout.txt'
    ) -Text $syntaxResult.Stdout
    Write-Utf8TextNoClobber -Path (
      Join-Path $continuationRootFull 'validator-syntax-stderr.txt'
    ) -Text $syntaxResult.Stderr
    Write-AsciiLinesNoClobber -Path (
      Join-Path $continuationRootFull `
        'validator-syntax-native-exit-status.txt'
    ) -Lines @("$($syntaxResult.ExitCode)")
    if (
      $syntaxResult.ExitCode -ne 0 -or
      $syntaxResult.Stdout.Length -ne 0 -or
      $syntaxResult.Stderr.Length -ne 0
    ) {
      throw 'D6.4 recovery FAIL: validator syntax preflight failed'
    }

    $executionValidatorItem = Assert-RegularFileNoReparse `
      -Path $validatorPath
    if (
      $executionValidatorItem.FullName -ine
        [System.IO.Path]::GetFullPath($validatorPath) -or
      (Get-FileHash -LiteralPath $executionValidatorItem.FullName `
        -Algorithm SHA256).Hash -cne $validatorHash -or
      $validatorHash -cne $authoritativeValidatorHash
    ) {
      throw 'D6.4 recovery FAIL: validator identity changed before execution'
    }
    $validatorResult = Invoke-NativeCapture -FilePath 'wsl.exe' -Arguments @(
      '-d',
      'AlmaLinux-9',
      '--',
      '/usr/bin/python3',
      '-B',
      $wslValidatorPath,
      'candidate',
      $wslOriginalHtml
    )
    Write-Utf8TextNoClobber -Path (
      Join-Path $continuationRootFull 'validator-stdout.txt'
    ) -Text $validatorResult.Stdout
    Write-Utf8TextNoClobber -Path (
      Join-Path $continuationRootFull 'validator-stderr.txt'
    ) -Text $validatorResult.Stderr
    Write-AsciiLinesNoClobber -Path (
      Join-Path $continuationRootFull 'validator-native-exit-status.txt'
    ) -Lines @("$($validatorResult.ExitCode)")
    $validatorOutputLines = @(
      Get-ExactNativeLines -Text $validatorResult.Stdout
    )
    if (
      $validatorResult.ExitCode -ne 0 -or
      $validatorResult.Stderr.Length -ne 0 -or
      $validatorOutputLines.Count -ne 1 -or
      $validatorOutputLines[0] -cne $requiredValidatorOutput
    ) {
      throw 'D6.4 recovery FAIL: structural validator result is not exact'
    }

    Write-Utf8LinesNoClobber -Path (
      Join-Path $continuationRootFull 'recovery-gates-complete.txt'
    ) -Lines @(
      'NON_FINAL_RECOVERY_GATES_VERIFIED=R1,R2,R3,R4,R5,R6',
      "ACCEPTED_VALIDATOR_PATH=$validatorPath",
      "ACCEPTED_VALIDATOR_SHA256=$validatorHash",
      'VALIDATOR_SYNTAX_NATIVE_EXIT_STATUS=0',
      'VALIDATOR_SYNTAX_STDOUT_EMPTY=YES',
      'VALIDATOR_SYNTAX_STDERR_EMPTY=YES',
      'VALIDATOR_NATIVE_EXIT_STATUS=0',
      "VALIDATOR_RESULT=$requiredValidatorOutput",
      'VALIDATOR_STDERR_EMPTY=YES',
      'HTTPS_REQUESTS_REPEATED=NO',
      'ROLLBACK_REQUIRED=NO',
      'FINAL_CLASSIFICATION=PENDING'
    )
    $gatesComplete = $true
  }
  finally {
    if ($transcriptStarted) {
      Stop-Transcript -ErrorAction Stop | Out-Null
      $transcriptStarted = $false
    }
  }

  # R7 — Nothing is classified until transcript closure and exact sealing pass.
  if (-not $gatesComplete) {
    throw 'D6.4 recovery FAIL: non-final recovery gates are incomplete'
  }
  Assert-ExactRegularInventory -Root $continuationRootFull `
    -ExpectedLeafNames $preManifestLeafNames

  $checksumPath = Join-Path $continuationRootFull $manifestLeafName
  $checksumLines = @(
    $preManifestLeafNames |
      Sort-Object |
      ForEach-Object {
        $evidencePath = Join-Path $continuationRootFull $_
        $evidenceItem = Assert-RegularFileNoReparse -Path $evidencePath
        $evidenceHash = (
          Get-FileHash -LiteralPath $evidenceItem.FullName -Algorithm SHA256
        ).Hash
        "$evidenceHash  $($evidenceItem.FullName)"
      }
  )
  Write-AsciiLinesNoClobber -Path $checksumPath -Lines $checksumLines
  Assert-ExactRegularInventory -Root $continuationRootFull `
    -ExpectedLeafNames @($preManifestLeafNames + $manifestLeafName)
  $continuationManifestState = Assert-ContinuationManifest `
    -ManifestPath $checksumPath -ExpectedLeafNames $preManifestLeafNames
  $continuationManifestHash = (
    Get-FileHash -LiteralPath $checksumPath -Algorithm SHA256
  ).Hash
  if ($continuationManifestHash -cnotmatch '^[0-9A-F]{64}$') {
    throw 'D6.4 recovery FAIL: continuation manifest hash is malformed'
  }
  $validatorFullPath = [System.IO.Path]::GetFullPath($validatorPath)
  if (
    -not $continuationManifestState.Entries.ContainsKey($validatorFullPath) -or
    $continuationManifestState.Entries[$validatorFullPath] -cne $validatorHash
  ) {
    throw 'D6.4 recovery FAIL: validator is not bound to continuation manifest'
  }
  $finalSealedState = Assert-SealedEvidence
  Assert-ExactRegularInventory -Root $continuationRootFull `
    -ExpectedLeafNames @($preManifestLeafNames + $manifestLeafName)
  $continuationManifestState = Assert-ContinuationManifest `
    -ManifestPath $checksumPath -ExpectedLeafNames $preManifestLeafNames
  if (
    $continuationManifestState.Entries[$validatorFullPath] -cne
      $validatorHash -or
    (Get-FileHash -LiteralPath $checksumPath -Algorithm SHA256).Hash -cne
      $continuationManifestHash
  ) {
    throw 'D6.4 recovery FAIL: final continuation binding recheck failed'
  }

  # R8 — Build after sealing; the atomic no-clobber move is the last action.
  $finalPath = Join-Path $continuationRootFull $finalLeafName
  $finalLines = @(
    'D6_4_PRIVATE_VALIDATOR_RECOVERY=PASS',
    "RUNBOOK_CONTROL_COMMIT=$runbookControlCommit",
    "SEALED_REQUEST_EVIDENCE_ROOT=$sealedRootFull",
    "SEALED_REQUEST_CHECKSUM_MANIFEST=$sealedManifest",
    "SEALED_REQUEST_CHECKSUM_MANIFEST_SHA256=$($finalSealedState.ManifestHash)",
    'SEALED_REQUEST_EVIDENCE_FILES_VERIFIED=13',
    "ORIGINAL_DAY_VIEW_HTML=$originalHtml",
    "ORIGINAL_DAY_VIEW_SHA256=$($finalSealedState.HtmlHash)",
    "ORIGINAL_DAY_VIEW_SIZE=$($finalSealedState.HtmlSize)",
    "STRUCTURAL_VALIDATION_CONTINUATION_ROOT=$continuationRootFull",
    "STRUCTURAL_VALIDATION_CONTINUATION_MANIFEST=$checksumPath",
    "STRUCTURAL_VALIDATION_CONTINUATION_MANIFEST_SHA256=$continuationManifestHash",
    "ACCEPTED_VALIDATOR_PATH=$validatorFullPath",
    "ACCEPTED_VALIDATOR_SHA256=$validatorHash",
    "VALIDATOR_RESULT=$requiredValidatorOutput",
    'HTTPS_REQUESTS_REPEATED=NO',
    'ROLLBACK_REQUIRED=NO',
    'D6_4=PASS',
    'D6_5=MAY_BEGIN'
  )
  Publish-AtomicUtf8NoClobber -FinalPath $finalPath -Lines $finalLines
}
```

The command intentionally extracts the D4.5 source from `git show` at the
validated control commit, requires one marker and exactly one source terminator
inside the expected Bash fence, and requires the fixed source SHA-256 before
syntax preflight. The validator uses Python's standard-library `html.parser`
structure, not regular expressions or substring counts, as HTML authority.

The continuation manifest covers exactly 14 pre-completion files. It excludes
itself and the final completion record. After the transcript is closed, the
procedure creates and strictly verifies that manifest, rechecks all sealed
original evidence, and then atomically publishes the final record. On failure,
the continuation root and any temporary publication file remain preserved; the
procedure never cleans up, overwrites, or edits the sealed root.

The final-publication helper rechecks the continuation root's canonical
identity and non-reparse status immediately before creating the temporary final
record. Validator identity and SHA-256 are likewise rechecked immediately
before syntax preflight and again immediately before structural execution.
These checks narrow but do not eliminate concurrent-local-writer TOCTOU risk
under Windows filesystem semantics. The operational model therefore requires
one trusted operator and controlled local access to the evidence parent for the
entire procedure.

## Acceptance And Handoff

D6.4 is complete only when the fixed
`d6-private-validator-completion-summary.txt` exists as a regular
non-reparse-point file and a later handoff check proves:

- the approved control commit is the direct, single-parent, non-merge child of
  `58f374a018792f16ab30cfd548000d5b20a6b3da`;
- the original manifest retains its fixed SHA-256, strictly lists 13 unique
  immediate regular non-reparse-point files, every one of those 13 hashes is
  recomputed successfully, and a forced inventory proves the sealed root is
  exactly those files plus the manifest with no hidden or system addition;
- Windows and WSL agree on the original HTML SHA-256 and exact 26805-byte size;
- validator syntax stdout and stderr are empty and syntax native exit is zero;
- validator stdout is exactly
  `DAY_VIEW_STRUCTURE=PASS mode=candidate panels=10`, stderr is empty, and
  native exit is zero;
- the continuation manifest strictly contains the exact 14-file
  pre-completion set, contains no duplicate or malformed path, and verifies
  every regular non-reparse-point file;
- the final record's continuation-manifest path and SHA-256 match the accepted
  manifest;
- the final record's validator path and SHA-256 match both the manifest entry
  and an immediate recomputation;
- the final root inventory is exactly the 14 pre-completion files, the
  continuation manifest, and the final completion record;
- the final record states `HTTPS_REQUESTS_REPEATED=NO`,
  `ROLLBACK_REQUIRED=NO`, `D6_4=PASS`, and `D6_5=MAY_BEGIN`.

D6.5 must run the binding check in the authoritative Checkpoint D runbook
before its server-side repository commands. Preserve both roots and both
checksum manifests as one combined D6.4 evidence set.
