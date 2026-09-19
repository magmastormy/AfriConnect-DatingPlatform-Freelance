import 'package:flutter/material.dart';

import '../services.dart';
import '../theme/app_theme.dart';

/// Three-way appearance control: Light / Dark / System.
///
/// Deliberately a segmented control rather than a binary switch, so "System"
/// stays reachable — a member who never chose explicitly must be able to go
/// back to following their device. Rendered as a pill of muted glyph+label
/// segments on a raised surface, with the active segment filled in the brand
/// colour, matching the web client's `ThemeToggle`.
class ThemeModeSelector extends StatelessWidget {
  const ThemeModeSelector({super.key, this.showLabels = false});

  /// The web hides the labels below 1040px and lets the glyph carry the
  /// meaning; do the same on narrow phones where the row is tight.
  final bool showLabels;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return ListenableBuilder(
      listenable: AppServices.theme,
      builder: (context, _) {
        final current = AppServices.theme.mode;
        return Container(
          padding: const EdgeInsets.all(3),
          decoration: BoxDecoration(
            color: palette.surfaceRaised,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: palette.line),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (final option in _AppearanceOption.values)
                _Segment(
                  option: option,
                  selected: current == option.mode,
                  showLabel: showLabels,
                  onTap: () => AppServices.theme.setMode(option.mode),
                ),
            ],
          ),
        );
      },
    );
  }
}

enum _AppearanceOption {
  light(ThemeMode.light, 'Light', Icons.light_mode_outlined),
  dark(ThemeMode.dark, 'Dark', Icons.dark_mode_outlined),
  system(ThemeMode.system, 'System', Icons.brightness_auto_outlined);

  const _AppearanceOption(this.mode, this.label, this.icon);

  final ThemeMode mode;
  final String label;
  final IconData icon;
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.option,
    required this.selected,
    required this.showLabel,
    required this.onTap,
  });

  final _AppearanceOption option;
  final bool selected;
  final bool showLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    // White on the brand fill is the established "on-brand" treatment used by
    // every filled control in both clients, so the active segment matches.
    final foreground = selected ? palette.onBrand : palette.muted;
    return Semantics(
      button: true,
      selected: selected,
      label: '${option.label} theme',
      child: Material(
        color: selected ? AppColors.clay : Colors.transparent,
        borderRadius: BorderRadius.circular(999),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(999),
          child: Padding(
            // Vertical padding is sized so each segment clears ~40dp of touch
            // height — the web control is sized for a mouse, a phone is not.
            padding: EdgeInsets.symmetric(
                horizontal: showLabel ? 13 : 12, vertical: 9),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(option.icon, size: 15, color: foreground),
                if (showLabel) ...[
                  const SizedBox(width: 6),
                  Text(
                    option.label,
                    style: TextStyle(
                        color: foreground,
                        fontSize: 12,
                        fontWeight: FontWeight.w700),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
