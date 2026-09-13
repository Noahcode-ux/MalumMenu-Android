import { AssemblyHelper } from "../core/AssemblyHelper";
import { BaseModule } from "../core/BaseModule";
import { State } from "../data/State";
import { Logger } from "../logger/Logger";

export class AccountModule extends BaseModule {
    public readonly name = "Account";

    private static readonly classPattern = /(Account|Auth|Sign|Login|Chat|Quick|Guardian|Age)/i;
    private static readonly forceTruePattern =
        /(CanUseFreeChat|CanUseTextChat|CanSendChat|CanChat|AllowFreeChat|TextChatAllowed|HasAccount|IsSignedIn|IsLoggedIn|HasAcceptedChat)/i;
    private static readonly forceFalsePattern = /(QuickChatOnly|RequireQuick|IsGuest|IsMinor|UnderAge|Underage|Parental|Restricted|AgeGate)/i;

    public init(): void {}

    public override initHooks(): void {
        let hookedCount = 0;

        for (const klass of AssemblyHelper.AssemblyCSharp.classes) {
            if (!AccountModule.classPattern.test(klass.name)) {
                continue;
            }

            for (const method of klass.methods) {
                if (method.returnType.name !== "System.Boolean" || method.parameterCount !== 0) {
                    continue;
                }

                const forcedValue = this.getForcedValue(method.name);
                if (forcedValue === null) {
                    continue;
                }

                const methodName = method.name;
                const parameterCount = method.parameterCount;

                method.implementation = function (): boolean {
                    if (!State.accountBypassChatUnlock) {
                        return this.method<boolean>(methodName, parameterCount).invoke();
                    }

                    return forcedValue;
                };

                hookedCount++;
                Logger.debug(`[${this.name}::initHooks] Hooked ${klass.name}.${methodName}() -> ${forcedValue}`);
            }
        }

        if (hookedCount === 0) {
            Logger.warn(`[${this.name}::initHooks] No account/chat eligibility methods were found`);
            return;
        }

        Logger.info(`[${this.name}::initHooks] Hooked ${hookedCount} account/chat eligibility methods`);
    }

    private getForcedValue(methodName: string): boolean | null {
        if (AccountModule.forceFalsePattern.test(methodName)) {
            return false;
        }

        if (AccountModule.forceTruePattern.test(methodName)) {
            return true;
        }

        return null;
    }
}
