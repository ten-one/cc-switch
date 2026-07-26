import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { WindowSettings } from "@/components/settings/WindowSettings";
import type { SettingsFormState } from "@/hooks/useSettings";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const createSettings = (
  overrides: Partial<SettingsFormState> = {},
): SettingsFormState =>
  ({
    showInTray: true,
    minimizeToTrayOnClose: true,
    autoLightweightMode: false,
    autoLightweightDelayMinutes: 10,
    language: "zh",
    ...overrides,
  }) as SettingsFormState;

describe("WindowSettings auto lightweight mode", () => {
  it("disables the setting when close-to-tray is off and hides the delay input", () => {
    render(
      <WindowSettings
        settings={createSettings({
          minimizeToTrayOnClose: false,
          autoLightweightMode: true,
        })}
        onChange={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("switch", { name: "settings.autoLightweightMode" }),
    ).toBeDisabled();
    expect(
      screen.getByText("settings.autoLightweightModeRequiresTray"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("spinbutton", {
        name: "settings.autoLightweightDelay",
      }),
    ).not.toBeInTheDocument();
  });

  it("saves the switch and shows the configured delay while enabled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <WindowSettings settings={createSettings()} onChange={onChange} />,
    );

    await user.click(
      screen.getByRole("switch", { name: "settings.autoLightweightMode" }),
    );
    expect(onChange).toHaveBeenCalledWith({ autoLightweightMode: true });

    rerender(
      <WindowSettings
        settings={createSettings({
          autoLightweightMode: true,
          autoLightweightDelayMinutes: 30,
        })}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByRole("spinbutton", {
        name: "settings.autoLightweightDelay",
      }),
    ).toHaveValue(30);
  });

  it("commits integer delay on Enter and clamps values to the supported range", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <WindowSettings
        settings={createSettings({ autoLightweightMode: true })}
        onChange={onChange}
      />,
    );

    const input = screen.getByRole("spinbutton", {
      name: "settings.autoLightweightDelay",
    });
    await user.clear(input);
    await user.type(input, "25{Enter}");
    expect(onChange).toHaveBeenLastCalledWith({
      autoLightweightDelayMinutes: 25,
    });

    rerender(
      <WindowSettings
        settings={createSettings({
          autoLightweightMode: true,
          autoLightweightDelayMinutes: 25,
        })}
        onChange={onChange}
      />,
    );
    await user.clear(input);
    await user.type(input, "9999");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith({
      autoLightweightDelayMinutes: 1440,
    });

    rerender(
      <WindowSettings
        settings={createSettings({
          autoLightweightMode: true,
          autoLightweightDelayMinutes: 1440,
        })}
        onChange={onChange}
      />,
    );
    await user.clear(input);
    await user.type(input, "0");
    await user.tab();
    expect(onChange).toHaveBeenLastCalledWith({
      autoLightweightDelayMinutes: 1,
    });
  });

  it("restores an empty or escaped draft without saving", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <WindowSettings
        settings={createSettings({ autoLightweightMode: true })}
        onChange={onChange}
      />,
    );

    const input = screen.getByRole("spinbutton", {
      name: "settings.autoLightweightDelay",
    });
    await user.clear(input);
    await user.tab();
    expect(input).toHaveValue(10);
    expect(onChange).not.toHaveBeenCalled();

    await user.click(input);
    await user.clear(input);
    await user.type(input, "44{Escape}");
    expect(input).toHaveValue(10);
    expect(onChange).not.toHaveBeenCalled();
  });
});
