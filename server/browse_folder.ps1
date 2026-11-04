Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Application]::EnableVisualStyles()

$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Select Folder to Save Videos"
$dialog.ShowNewFolderButton = $true

if ($args.Count -gt 0) {
    $cleanArg = $args[0].Trim().Trim('"').Trim("'")
    if ($cleanArg.Length -eq 2 -and $cleanArg[1] -eq ':') {
        $cleanArg = $cleanArg + "\"
    }
    if (Test-Path $cleanArg) {
        $dialog.SelectedPath = $cleanArg
    }
}

$res = $dialog.ShowDialog()
if ($res -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dialog.SelectedPath
}
