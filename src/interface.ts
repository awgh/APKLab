import * as path from "path";
import * as fs from "fs";
import { commands, QuickPickItem, Uri, window, workspace } from "vscode";
import { extensionConfigName, outputChannel } from "./data/constants";
import { quickPickUtil } from "./utils/quick-picks";
import { Quark } from "./tools/quark-engine";
import { apktool } from "./tools/apktool";
import { git } from "./tools/git";
import { jadx } from "./tools/jadx";
import { SplitConfig } from "./tools/split-config";

export namespace UI {
    /**
     * Show a QuickPick with multiple items.
     * @param items QuickPickItems to show in the QuickPick.
     * @param placeHolder Place holder text in the box under QuickPick.
     * @returns string[] of the label for selected QuickPickItem[].
     */
    export async function showArgsQuickPick(
        items: QuickPickItem[],
        placeHolder: string,
    ): Promise<QuickPickItem[] | undefined> {
        return await window.showQuickPick(items, {
            placeHolder: placeHolder,
            canPickMany: true,
            matchOnDetail: true,
            matchOnDescription: true,
            ignoreFocusOut: true,
        });
    }

    /**
     * Show a APK file chooser window and decompile that APK.
     */
    export async function openApkFile(): Promise<void> {
        // browse for an APK file
        const result = await window.showOpenDialog({
            canSelectFolders: false,
            filters: {
                APK: ["apk"],
            },
            openLabel: "Select an APK file",
        });
        if (result && result.length === 1) {
            const quickPickItems = await showArgsQuickPick(
                quickPickUtil.getQuickPickItems("decodeQuickPickItems"),
                "Additional features & Apktool/Jadx arguments",
            );

            if (quickPickItems) {
                const args = quickPickItems.map<string>((item) => item.label);
                const argDescriptions = quickPickItems.map<string | undefined>(
                    (item) => item.description,
                );
                const decompileJavaIndex =
                    argDescriptions.indexOf("[Use Jadx]");
                const quarkAnalysisIndex =
                    argDescriptions.indexOf("[Use Quark-Engine]");
                const jadxOptionsIndex = argDescriptions.indexOf("jadx");
                const jadxOptionsNumber = argDescriptions.filter(
                    (item) => item === "jadx",
                ).length;
                const isSplitConfigApk =
                    argDescriptions.indexOf("split_config") > -1;
                let decompileJava = false;
                let quarkAnalysis = false;
                let jadxArgs: string[] = [];

                if (jadxOptionsIndex > -1) {
                    jadxArgs = args.splice(jadxOptionsIndex, jadxOptionsNumber);
                }
                if (decompileJavaIndex > -1) {
                    decompileJava = true;
                    args.splice(decompileJavaIndex, 1);
                }
                if (quarkAnalysisIndex > -1) {
                    quarkAnalysis = true;
                    args.splice(quarkAnalysisIndex, 1);
                    if (!Quark.checkQuarkInstalled()) {
                        quarkAnalysis = false;
                        window.showErrorMessage(
                            "APKLab: Quark command not found, \
                            please make sure you have installed python3 and Quark-Engine. \
                            Check here to install Quark-Engine: \
                            https://github.com/quark-engine/quark-engine",
                        );
                        return;
                    }
                }

                // project directory name
                const apkFilePath = result[0].fsPath;
                let projectDir = path.join(
                    path.dirname(apkFilePath),
                    path.parse(apkFilePath).name,
                );
                // don't delete the existing dir if it already exists
                while (fs.existsSync(projectDir)) {
                    projectDir = projectDir + "1";
                }

                if (isSplitConfigApk) {
                    const parentPath = path.parse(result[0].fsPath).dir;
                    SplitConfig.analyzeAllAPK(
                        parentPath,
                        apkFilePath,
                        projectDir,
                        args,
                        decompileJava,
                        jadxArgs,
                        quarkAnalysis
                    );
                } else {
                    await processApkFile(
                        apkFilePath,
                        projectDir,
                        args,
                        decompileJava,
                        jadxArgs,
                        quarkAnalysis,
                        true
                    );
                }
            }
        } else {
            outputChannel.appendLine("APKLAB: no APK file was chosen");
        }
    }
    export async function processApkFile(
        apkFilePath: string,
        projectDir: string,
        args: string[],
        decompileJava: boolean,
        jadxArgs: string[],
        quarkAnalysis: boolean,
        openNewWindow: boolean
    ): Promise<void> {
        // decode APK
        await apktool.decodeAPK(apkFilePath, projectDir, args);

        // decompile APK
        if (decompileJava) {
            await jadx.decompileAPK(apkFilePath, projectDir, jadxArgs);
        }
        // quark analysis
        if (quarkAnalysis) {
            await Quark.analyzeAPK(apkFilePath, projectDir);
        }

        // Initialize project dir as git repo
        const initializeGit = await workspace
            .getConfiguration(extensionConfigName)
            .get("initProjectDirAsGit");
        if (initializeGit)
            await git.initGitDir(projectDir, "Initial APKLab project");

        // open prodject

        // open project dir in a new window
        if (!process.env["TEST"] && openNewWindow) {
            await commands.executeCommand(
                "vscode.openFolder",
                Uri.file(projectDir),
                true,
            );
        }
    }
    /**
     * Show a QuickPick with extra args and build the APK.
     * @param apktoolYmlPath path of the `apktool.yml` file.
     */
    export async function rebuildAPK(
        apktoolYmlPath: string
    ): Promise<string[] | undefined> {
        const args = await rebuildArgs();
        if (args) {
            await apktool.rebuildAPK(apktoolYmlPath, args);
        }
        return args;
    }

    export async function rebuildArgs(): Promise<string[] | undefined>{
        const quickPickItems = await showArgsQuickPick(
            quickPickUtil.getQuickPickItems("rebuildQuickPickItems"),
            "Additional Apktool arguments",
        );
        const args = quickPickItems
            ? quickPickItems.map<string>((item) => item.label)
            : undefined;
            return args;
    }
}
