import ExpoModulesCore

public class EqualizerModule: Module {
  // Fixed center frequencies in milliHz (matching Android Equalizer)
  private static let centerFreqs = [60000, 230000, 910000, 3600000, 14000000]

  public func definition() -> ModuleDefinition {
    Name("Equalizer")

    Function("initialize") { (_: Int) -> Bool in
      return true
    }

    Function("setEnabled") { (_: Bool) in
      // no-op on iOS
    }

    Function("getNumberOfBands") { () -> Int in
      return 5
    }

    Function("getBandLevelRange") { () -> [Int] in
      return [-1500, 1500]
    }

    Function("getCenterFreq") { (band: Int) -> Int in
      guard band >= 0 && band < Self.centerFreqs.count else { return 0 }
      return Self.centerFreqs[band]
    }

    Function("getBandLevel") { (_: Int) -> Int in
      return 0
    }

    Function("setBandLevel") { (_: Int, _: Int) in
      // no-op on iOS
    }

    Function("getNumberOfPresets") { () -> Int in
      return 0
    }

    Function("getPresetName") { (_: Int) -> String in
      return ""
    }

    Function("usePreset") { (_: Int) in
      // no-op on iOS
    }

    Function("release") { () in
      // no-op on iOS
    }
  }
}
