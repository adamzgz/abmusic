package com.sonicflow.equalizer

import android.media.audiofx.Equalizer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class EqualizerModule : Module() {
  private var equalizer: Equalizer? = null

  override fun definition() = ModuleDefinition {
    Name("Equalizer")

    // Initialize the EQ attached to an audio session ID
    Function("initialize") { audioSessionId: Int ->
      try {
        equalizer?.release()
        equalizer = Equalizer(0, audioSessionId).apply {
          enabled = true
        }
        true
      } catch (e: Exception) {
        false
      }
    }

    // Enable or disable the equalizer
    Function("setEnabled") { enabled: Boolean ->
      equalizer?.enabled = enabled
    }

    // Get the number of bands
    Function("getNumberOfBands") {
      equalizer?.numberOfBands?.toInt() ?: 0
    }

    // Get band level range [min, max] in millibels
    Function("getBandLevelRange") {
      val range = equalizer?.bandLevelRange
      if (range != null && range.size == 2) {
        listOf(range[0].toInt(), range[1].toInt())
      } else {
        listOf(-1500, 1500)
      }
    }

    // Get center frequency of a band in milliHz
    Function("getCenterFreq") { band: Int ->
      equalizer?.getCenterFreq(band.toShort())?.toInt() ?: 0
    }

    // Get current band level in millibels
    Function("getBandLevel") { band: Int ->
      equalizer?.getBandLevel(band.toShort())?.toInt() ?: 0
    }

    // Set band level in millibels
    Function("setBandLevel") { band: Int, level: Int ->
      equalizer?.setBandLevel(band.toShort(), level.toShort())
    }

    // Get number of presets
    Function("getNumberOfPresets") {
      equalizer?.numberOfPresets?.toInt() ?: 0
    }

    // Get preset name by index
    Function("getPresetName") { preset: Int ->
      equalizer?.getPresetName(preset.toShort()) ?: ""
    }

    // Apply a preset
    Function("usePreset") { preset: Int ->
      equalizer?.usePreset(preset.toShort())
    }

    // Release the equalizer
    Function("release") {
      equalizer?.release()
      equalizer = null
    }

    // Clean up on module destroy
    OnDestroy {
      equalizer?.release()
      equalizer = null
    }
  }
}
