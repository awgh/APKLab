import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { apklabDataDir, outputChannel } from "./data/constants";
import { checkAndInstallTools, updateTools } from "./utils/updater";
import { UI } from "./interface";
import { apkMitm } from "./tools/apk-mitm";
import { Quark } from "./tools/quark-engine";
import { adb } from "./tools/adb";
import { apktool } from "./tools/apktool";
import { SplitConfig } from "./tools/split-config";

export function activate(context: vscode.ExtensionContext): void {
    console.log("Activated apklab extension!");

    // create apklabDataDir if it doesn't exist
    if (!fs.existsSync(String(apklabDataDir))) {
        fs.mkdirSync(apklabDataDir);
    }

    // command for opening an apk file for decoding
    const openApkFileCommand = vscode.commands.registerCommand(
        "apklab.openApkFile",
        async () => {
            checkAndInstallTools()
                .then(async () => {
                    UI.openApkFile();
                })
                .catch(() => {
                    outputChannel.appendLine(
                        "Can't download/update dependencies!",
                    );
                });
        },
    );

    // command for rebuilding apk file
    const rebuildAPkFileCommand = vscode.commands.registerCommand(
        "apklab.rebuildApkFile",
        (uri: vscode.Uri) => {
            checkAndInstallTools()
                .then(() => {
                    UI.rebuildAPK(uri.fsPath);
                })
                .catch(() => {
                    outputChannel.appendLine(
                        "Can't download/update dependencies!",
                    );
                });
        },
    );

    // command for installing apk file
    const installAPkFileCommand = vscode.commands.registerCommand(
        "apklab.installApkFile",
        (uri: vscode.Uri) => {
            adb.installAPK(uri.fsPath);
        },
    );

    // command for rebuilding and installing the apk
    const rebuildAndInstallAPkFileCommand = vscode.commands.registerCommand(
        "apklab.rebuildAndInstallApkFile",
        (uri: vscode.Uri) => {
            checkAndInstallTools()
                .then(async () => {
                    await UI.rebuildAPK(uri.fsPath);
                    const parentPath = path.parse(uri.fsPath).dir;
                    const apkPath = path.join(
                        parentPath,
                        "dist",
                        apktool.getApkNameFromApkToolYaml(uri.fsPath),
                    );
                    await adb.installAPK(apkPath);
                })
                .catch(() => {
                    outputChannel.appendLine(
                        "Can't download/update dependencies!",
                    );
                });
        },
    );

    // command for patching files for https inspection
    const patchApkForHttpsCommand = vscode.commands.registerCommand(
        "apklab.patchApkForHttps",
        (uri: vscode.Uri) => apkMitm.applyMitmPatches(uri.fsPath),
    );

    // command to empty apktool framework resource dir
    const emptyFrameworkDirCommand = vscode.commands.registerCommand(
        "apklab.emptyFrameworkDir",
        () => {
            checkAndInstallTools()
                .then(() => {
                    apktool.emptyFrameworkDir();
                })
                .catch(() => {
                    outputChannel.appendLine(
                        "Can't download/update dependencies!",
                    );
                });
        },
    );

    // command to show quark analysis report as web view
    const quarkReportCommand = vscode.commands.registerCommand(
        "apklab.quarkReport",
        (uri: vscode.Uri) => {
            Quark.showSummaryReport(uri.fsPath);
        },
    );

    // command to build all split apks
    const buildSplitApks = vscode.commands.registerCommand(
        "apklab.buildSplitApks",
        (uri: vscode.Uri) => {
            checkAndInstallTools()
                .then(() => {
                    SplitConfig.rebuildAllApks(uri.fsPath);
                })
                .catch(() => {
                    outputChannel.appendLine(
                        "Can't download/update dependencies!"
                    );
                });
        }
    );

    const installAllSplitApks = vscode.commands.registerCommand(
        "apklab.installAllSplitApks",
        (uri: vscode.Uri) => {
            SplitConfig.installAllApks(uri.fsPath);
        }
    );

    const rebuildAndInstallAllSplitApks = vscode.commands.registerCommand(
        "apklab.rebuildAndinstallAllSplitApks",
        async (uri:vscode.Uri)=> {
            await SplitConfig.rebuildAllApks(uri.fsPath)
            await SplitConfig.installAllApks(uri.fsPath)
        }
    )

    context.subscriptions.push(
        openApkFileCommand,
        rebuildAPkFileCommand,
        installAPkFileCommand,
        rebuildAndInstallAPkFileCommand,
        patchApkForHttpsCommand,
        emptyFrameworkDirCommand,
        quarkReportCommand,
        buildSplitApks,
        installAllSplitApks,
        rebuildAndInstallAllSplitApks,
    );

    // check if open folder contains `quarkReport.json` file
    // if it exists, show it as a report on open
    const folders = vscode.workspace.workspaceFolders;
    if (folders && folders.length > 0) {
        const quarkReportFile = path.join(
            folders[0].uri.fsPath,
            "quarkReport.json",
        );
        if (fs.existsSync(quarkReportFile)) {
            Quark.showSummaryReport(quarkReportFile);
        }
    }

    // check for the tools update
    updateTools();
}
