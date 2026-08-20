"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, SectionLabel } from "@/components/ui/card";
import { FieldGroup, SliderField, ToggleField } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSettingsStore } from "@/lib/store/settings-store";

export function TuningPanel() {
  const attention = useSettingsStore((state) => state.attention);
  const preferences = useSettingsStore((state) => state.preferences);
  const setAttention = useSettingsStore((state) => state.setAttention);
  const setPreference = useSettingsStore((state) => state.setPreference);
  const resetTuning = useSettingsStore((state) => state.resetTuning);

  return (
    <Card>
      <div className="flex items-start justify-between gap-4 px-6 pt-6">
        <div>
          <SectionLabel>Tuning</SectionLabel>
          <h2 className="mt-2 text-base font-semibold tracking-tight">
            Triggers &amp; sensitivity
          </h2>
        </div>
        <Button variant="ghost" size="sm" onClick={resetTuning}>
          <RotateCcw />
          Reset
        </Button>
      </div>

      <div className="px-6 pb-6 pt-4">
        <Tabs defaultValue="triggers">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="triggers">Triggers</TabsTrigger>
            <TabsTrigger value="sensitivity">Sensitivity</TabsTrigger>
            <TabsTrigger value="playback">Playback</TabsTrigger>
          </TabsList>

          <TabsContent value="triggers">
            <FieldGroup>
              <ToggleField
                label="Look-away trigger"
                hint="Uses the camera to detect when your attention leaves the monitor. Frames are processed on-device and never uploaded."
                checked={preferences.gazeTriggerEnabled}
                onCheckedChange={(value) =>
                  setPreference("gazeTriggerEnabled", value)
                }
              />
              <ToggleField
                label="Inactivity fallback"
                hint="Independent of the camera. If nothing is typed, clicked, or scrolled for the timeout, playback starts fullscreen and stays up until you close it."
                checked={preferences.idleTriggerEnabled}
                onCheckedChange={(value) =>
                  setPreference("idleTriggerEnabled", value)
                }
              />
              <SliderField
                label="Inactivity timeout"
                hint="How long the machine must go untouched before the fallback fires."
                value={preferences.idleTimeoutMs / 1000}
                display={`${Math.round(preferences.idleTimeoutMs / 1000)}s`}
                min={10}
                max={600}
                step={5}
                disabled={!preferences.idleTriggerEnabled}
                onChange={(value) =>
                  setPreference("idleTimeoutMs", Math.round(value) * 1000)
                }
              />
              <SliderField
                label="Look-away delay"
                hint="How long your attention must stay off-screen before a clip starts. Raise it if glancing at your keyboard triggers playback."
                value={attention.awayDelayMs}
                display={`${(attention.awayDelayMs / 1000).toFixed(1)}s`}
                min={200}
                max={5000}
                step={100}
                disabled={!preferences.gazeTriggerEnabled}
                onChange={(value) => setAttention({ awayDelayMs: value })}
              />
              <SliderField
                label="Look-back delay"
                hint="How quickly playback stops once you are back on screen. Keep this short — it is the responsiveness you feel most."
                value={attention.returnDelayMs}
                display={`${(attention.returnDelayMs / 1000).toFixed(1)}s`}
                min={0}
                max={2000}
                step={50}
                disabled={!preferences.gazeTriggerEnabled}
                onChange={(value) => setAttention({ returnDelayMs: value })}
              />
            </FieldGroup>
          </TabsContent>

          <TabsContent value="sensitivity">
            <FieldGroup>
              <SliderField
                label="Head tolerance"
                hint="Degrees of head rotation treated as still looking at the screen. Larger monitors and closer seating want a wider angle."
                value={attention.headTolerance}
                display={`±${Math.round(attention.headTolerance)}°`}
                min={8}
                max={50}
                step={1}
                onChange={(value) => setAttention({ headTolerance: value })}
              />
              <SliderField
                label="Eye tolerance"
                hint="How far your eyes may wander within their sockets before it counts against attention."
                value={attention.gazeTolerance}
                display={attention.gazeTolerance.toFixed(2)}
                min={0.1}
                max={1}
                step={0.02}
                onChange={(value) => setAttention({ gazeTolerance: value })}
              />
              <SliderField
                label="Look-away threshold"
                hint="Confidence at or below which you count as having looked away. Sits below the look-back threshold on purpose — the gap stops the state flickering."
                value={attention.exitThreshold}
                display={`${Math.round(attention.exitThreshold * 100)}%`}
                min={0.05}
                max={Math.max(0.06, attention.enterThreshold - 0.05)}
                step={0.01}
                onChange={(value) => setAttention({ exitThreshold: value })}
              />
              <SliderField
                label="Look-back threshold"
                hint="Confidence needed to count as focused again."
                value={attention.enterThreshold}
                display={`${Math.round(attention.enterThreshold * 100)}%`}
                min={Math.min(0.95, attention.exitThreshold + 0.05)}
                max={0.95}
                step={0.01}
                onChange={(value) => setAttention({ enterThreshold: value })}
              />
              <SliderField
                label="Smoothing"
                hint="Time constant of the signal filter. Higher is steadier but slower to react."
                value={attention.smoothingTau}
                display={`${Math.round(attention.smoothingTau)}ms`}
                min={40}
                max={600}
                step={10}
                onChange={(value) => setAttention({ smoothingTau: value })}
              />
              <SliderField
                label="Out-of-frame grace"
                hint="How long your face may be missing before it counts as looking away. Covers the odd dropped detection."
                value={attention.faceLostGraceMs}
                display={`${(attention.faceLostGraceMs / 1000).toFixed(1)}s`}
                min={200}
                max={5000}
                step={100}
                onChange={(value) => setAttention({ faceLostGraceMs: value })}
              />
            </FieldGroup>
          </TabsContent>

          <TabsContent value="playback">
            <FieldGroup>
              <ToggleField
                label="Fullscreen on inactivity"
                hint="The fallback takes over the whole screen, as the fallback is meant to."
                checked={preferences.fullscreenOnIdle}
                onCheckedChange={(value) =>
                  setPreference("fullscreenOnIdle", value)
                }
              />
              <ToggleField
                label="Fullscreen on look-away"
                hint="Off by default: a look-away clip that fills the screen is harder to glance past when you turn back."
                checked={preferences.fullscreenOnAway}
                onCheckedChange={(value) =>
                  setPreference("fullscreenOnAway", value)
                }
              />
              <ToggleField
                label="Resume where it stopped"
                hint="On: a clip picks up where your last look-away left it. Off: every trigger starts from the beginning."
                checked={preferences.resumePolicy === "resume"}
                onCheckedChange={(value) =>
                  setPreference("resumePolicy", value ? "resume" : "restart")
                }
              />
              <ToggleField
                label="Loop clip"
                checked={preferences.loop}
                onCheckedChange={(value) => setPreference("loop", value)}
              />
              <ToggleField
                label="Shuffle library"
                hint="Advance to a random clip instead of the next one in order."
                checked={preferences.shuffle}
                onCheckedChange={(value) => setPreference("shuffle", value)}
              />
              <ToggleField
                label="Fade audio"
                hint="Ramps the volume instead of cutting it, so playback starting behind you is less startling."
                checked={preferences.softFade}
                onCheckedChange={(value) => setPreference("softFade", value)}
              />
              <SliderField
                label="Volume"
                value={preferences.volume}
                display={`${Math.round(preferences.volume * 100)}%`}
                min={0}
                max={1}
                step={0.05}
                disabled={preferences.muted}
                onChange={(value) => setPreference("volume", value)}
              />
              <ToggleField
                label="Start muted"
                checked={preferences.muted}
                onCheckedChange={(value) => setPreference("muted", value)}
              />
              <ToggleField
                label="Keep camera preview visible"
                hint="Shows a small live preview inside the player so you can see the tracker is still watching."
                checked={preferences.keepPreviewDuringPlayback}
                onCheckedChange={(value) =>
                  setPreference("keepPreviewDuringPlayback", value)
                }
              />
              <ToggleField
                label="Draw face landmarks"
                checked={preferences.showLandmarks}
                onCheckedChange={(value) => setPreference("showLandmarks", value)}
              />
              <ToggleField
                label="Mirror preview"
                checked={preferences.mirrorPreview}
                onCheckedChange={(value) => setPreference("mirrorPreview", value)}
              />
            </FieldGroup>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}
