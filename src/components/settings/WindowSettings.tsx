import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SettingsFormState } from "@/hooks/useSettings";
import { AppWindow, MonitorUp, Power, EyeOff, Timer } from "lucide-react";
import { ToggleRow } from "@/components/ui/toggle-row";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";
import { isLinux } from "@/lib/platform";
import {
  AUTO_LIGHTWEIGHT_DELAY_MINUTES,
  normalizeAutoLightweightDelayMinutes,
} from "@/config/constants";

interface WindowSettingsProps {
  settings: SettingsFormState;
  onChange: (updates: Partial<SettingsFormState>) => void;
}

export function WindowSettings({ settings, onChange }: WindowSettingsProps) {
  const { t } = useTranslation();
  const persistedDelay = normalizeAutoLightweightDelayMinutes(
    settings.autoLightweightDelayMinutes,
  );
  const [delayDraft, setDelayDraft] = useState(String(persistedDelay));

  useEffect(() => {
    setDelayDraft(String(persistedDelay));
  }, [persistedDelay]);

  const commitDelay = () => {
    if (!delayDraft.trim()) {
      setDelayDraft(String(persistedDelay));
      return;
    }

    const normalized = normalizeAutoLightweightDelayMinutes(Number(delayDraft));
    setDelayDraft(String(normalized));
    if (normalized !== persistedDelay) {
      onChange({ autoLightweightDelayMinutes: normalized });
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b border-border/40">
        <AppWindow className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-medium">{t("settings.windowBehavior")}</h3>
      </div>

      <div className="space-y-3">
        <ToggleRow
          icon={<Power className="h-4 w-4 text-orange-500" />}
          title={t("settings.launchOnStartup")}
          description={t("settings.launchOnStartupDescription")}
          checked={!!settings.launchOnStartup}
          onCheckedChange={(value) => onChange({ launchOnStartup: value })}
        />

        <AnimatePresence initial={false}>
          {settings.launchOnStartup && (
            <motion.div
              key="silent-startup"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3 }}
            >
              <ToggleRow
                icon={<EyeOff className="h-4 w-4 text-green-500" />}
                title={t("settings.silentStartup")}
                description={t("settings.silentStartupDescription")}
                checked={!!settings.silentStartup}
                onCheckedChange={(value) => onChange({ silentStartup: value })}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <ToggleRow
          icon={<MonitorUp className="h-4 w-4 text-purple-500" />}
          title={t("settings.enableClaudePluginIntegration")}
          description={t("settings.enableClaudePluginIntegrationDescription")}
          checked={!!settings.enableClaudePluginIntegration}
          onCheckedChange={(value) =>
            onChange({ enableClaudePluginIntegration: value })
          }
        />

        <ToggleRow
          icon={<MonitorUp className="h-4 w-4 text-cyan-500" />}
          title={t("settings.skipClaudeOnboarding")}
          description={t("settings.skipClaudeOnboardingDescription")}
          checked={!!settings.skipClaudeOnboarding}
          onCheckedChange={(value) => onChange({ skipClaudeOnboarding: value })}
        />

        <ToggleRow
          icon={<AppWindow className="h-4 w-4 text-blue-500" />}
          title={t("settings.minimizeToTray")}
          description={t("settings.minimizeToTrayDescription")}
          checked={settings.minimizeToTrayOnClose}
          onCheckedChange={(value) =>
            onChange({ minimizeToTrayOnClose: value })
          }
        />

        <ToggleRow
          icon={<Timer className="h-4 w-4 text-emerald-500" />}
          title={t("settings.autoLightweightMode")}
          description={
            settings.minimizeToTrayOnClose
              ? t("settings.autoLightweightModeDescription")
              : t("settings.autoLightweightModeRequiresTray")
          }
          checked={settings.autoLightweightMode}
          onCheckedChange={(value) => onChange({ autoLightweightMode: value })}
          disabled={!settings.minimizeToTrayOnClose}
        />

        <AnimatePresence initial={false}>
          {settings.minimizeToTrayOnClose && settings.autoLightweightMode && (
            <motion.div
              key="auto-lightweight-delay"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="ml-11 flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 px-4 py-3"
            >
              <label
                htmlFor="auto-lightweight-delay"
                className="text-sm text-muted-foreground"
              >
                {t("settings.autoLightweightDelay")}
              </label>
              <Input
                id="auto-lightweight-delay"
                type="number"
                min={AUTO_LIGHTWEIGHT_DELAY_MINUTES.MIN}
                max={AUTO_LIGHTWEIGHT_DELAY_MINUTES.MAX}
                step={1}
                inputMode="numeric"
                value={delayDraft}
                onChange={(event) => setDelayDraft(event.target.value)}
                onBlur={commitDelay}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    commitDelay();
                  } else if (event.key === "Escape") {
                    setDelayDraft(String(persistedDelay));
                  }
                }}
                aria-label={t("settings.autoLightweightDelay")}
                className="h-8 w-24"
              />
              <span className="text-sm text-muted-foreground">
                {t("settings.minutes")}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {isLinux() && (
          <ToggleRow
            icon={<AppWindow className="h-4 w-4 text-amber-500" />}
            title={t("settings.useAppWindowControls")}
            description={t("settings.useAppWindowControlsDescription")}
            checked={!!settings.useAppWindowControls}
            onCheckedChange={(value) =>
              onChange({ useAppWindowControls: value })
            }
          />
        )}
      </div>
    </section>
  );
}
