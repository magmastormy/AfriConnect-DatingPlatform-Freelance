import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/app_widgets.dart';
import '../../core/widgets/nia_interactions.dart';
import '../../core/widgets/nia_kit.dart';

/// A playground that applies the two dashboard page styles (prompts 1–2) and
/// the eleven interaction components (prompts 3–13) to AfriConnect's Nia design
/// system. Each component is shown live with a one-line note on where it would
/// live in the real app.
class InteractionsShowcaseScreen extends StatefulWidget {
  const InteractionsShowcaseScreen({super.key});

  @override
  State<InteractionsShowcaseScreen> createState() =>
      _InteractionsShowcaseScreenState();
}

class _InteractionsShowcaseScreenState
    extends State<InteractionsShowcaseScreen> {
  String _tab = 'biz';

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Scaffold(
      backgroundColor: palette.background,
      appBar: AppBar(
        backgroundColor: palette.background,
        foregroundColor: palette.ink,
        elevation: 0,
        title: const BrandWordmark(),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: CircleIconButton(
              icon: Icons.palette_rounded,
              onTap: () {},
              onMedia: false,
            ),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
            child: SegmentedSwitcher<String>(
              options: const [
                SegmentedOption(value: 'biz', label: '数据后台'),
                SegmentedOption(value: 'personal', label: '个人工具'),
                SegmentedOption(value: 'components', label: '交互组件'),
              ],
              selected: _tab,
              onChanged: (v) => setState(() => _tab = v),
              contentFor: (tab) {
                switch (tab) {
                  case 'biz':
                    return const DashboardBusiness();
                  case 'personal':
                    return const DashboardPersonal();
                  default:
                    return const ComponentsGallery();
                }
              },
            ),
          ),
          Expanded(
            child: AnimatedSwitcher(
              duration: NiaMotion.base,
              child: KeyedSubtree(
                key: ValueKey(_tab),
                child: switch (_tab) {
                  'biz' => const DashboardBusiness(),
                  'personal' => const DashboardPersonal(),
                  _ => const ComponentsGallery(),
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt 1 · 极简商务风 · 企业数据后台
// Maps to: an AfriConnect owner / admin Insights dashboard.
// ─────────────────────────────────────────────────────────────────────────────

class DashboardBusiness extends StatelessWidget {
  const DashboardBusiness({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top nav
          Row(
            children: [
              Expanded(
                child: SearchPill(placeholder: 'Search members, events…'),
              ),
              const SizedBox(width: 10),
              InitialAvatar('S', size: 44),
            ],
          ),
          const SizedBox(height: 20),
          Text('Overview', style: editorial(24, weight: FontWeight.w700)),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: _BizStat(
                  value: '1,284',
                  label: 'Active members',
                  trend: '+8.2%',
                  good: true,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _BizStat(
                  value: '342',
                  label: 'New this week',
                  trend: '+12%',
                  good: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _BizStat(
                  value: '68%',
                  label: 'Vetting pass',
                  trend: '-3.1%',
                  good: false,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _BizStat(
                  value: '4.6',
                  label: 'Avg. rating',
                  trend: '+0.2',
                  good: true,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          SurfaceCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SectionHeader('Matches, last 7 days', action: 'Export'),
                const SizedBox(height: 4),
                const NiaTrendLine(
                  points: [12, 18, 15, 22, 19, 28, 26, 33, 30, 38],
                  height: 120,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          SectionHeader('Recent activity'),
          const SizedBox(height: 8),
          SurfaceCard(
            padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 16),
            child: Column(
              children: const [
                _BizRow(
                  icon: Icons.favorite_rounded,
                  title: 'Ada matched with Kwame',
                  trailing: '2m',
                ),
                Hairline(),
                _BizRow(
                  icon: Icons.verified_rounded,
                  title: 'Zara passed vetting',
                  trailing: '14m',
                ),
                Hairline(),
                _BizRow(
                  icon: Icons.event_rounded,
                  title: 'Lagos mixer — 38 RSVPs',
                  trailing: '1h',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BizStat extends StatelessWidget {
  const _BizStat({
    required this.value,
    required this.label,
    required this.trend,
    required this.good,
  });

  final String value;
  final String label;
  final String trend;
  final bool good;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(value, style: numeral(28, weight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(label, style: inter(13, color: palette.muted)),
          const SizedBox(height: 8),
          StatusPill(
            trend,
            tone: good ? PillTone.good : PillTone.warn,
          ),
        ],
      ),
    );
  }
}

class _BizRow extends StatelessWidget {
  const _BizRow({
    required this.icon,
    required this.title,
    required this.trailing,
  });

  final IconData icon;
  final String title;
  final String trailing;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 52),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: palette.surfaceRaised,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 18, color: palette.inkSoft),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: inter(14.5, weight: FontWeight.w600, color: palette.ink)),
          ),
          Text(trailing, style: niaLabel(12, weight: FontWeight.w600)
              .copyWith(color: palette.muted)),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt 2 · 清爽轻量风 · 个人工具页
// Maps to: a member's personal Activity / Stats page.
// ─────────────────────────────────────────────────────────────────────────────

class DashboardPersonal extends StatelessWidget {
  const DashboardPersonal({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Your week', style: editorial(24, weight: FontWeight.w700)),
          const SizedBox(height: 14),
          // Three-column row of big rounded cards.
          Row(
            children: [
              Expanded(
                child: _ToolCard(
                  icon: Icons.favorite_rounded,
                  value: '9',
                  label: 'Likes sent',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _ToolCard(
                  icon: Icons.star_rounded,
                  value: '3',
                  label: 'Superlikes',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _ToolCard(
                  icon: Icons.chat_bubble_rounded,
                  value: '5',
                  label: 'Conversations',
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Center(
            child: NiaRingProgress(
              value: 0.72,
              size: 132,
              stroke: 12,
              label: '72%',
              sublabel: 'profile',
            ),
          ),
          const SizedBox(height: 18),
          SectionHeader('Changes'),
          const SizedBox(height: 8),
          SurfaceCard(
            padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 16),
            child: Column(
              children: const [
                _ChangeRow(label: 'Profile views', delta: '+18', good: true),
                Hairline(),
                _ChangeRow(label: 'New matches', delta: '+5', good: true),
                Hairline(),
                _ChangeRow(label: 'Unread', delta: '-2', good: false),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ToolCard extends StatelessWidget {
  const _ToolCard({
    required this.icon,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Container(
      height: 116,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: palette.surface,
        borderRadius: BorderRadius.circular(NiaRadius.lg),
        border: Border.all(color: palette.line),
        boxShadow: niaShadowSoft(palette.ink),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 22, color: AppColors.clay),
          const Spacer(),
          Text(value, style: numeral(26, weight: FontWeight.w700)),
          const SizedBox(height: 2),
          Text(label, style: inter(11.5, color: palette.muted)),
        ],
      ),
    );
  }
}

class _ChangeRow extends StatelessWidget {
  const _ChangeRow({
    required this.label,
    required this.delta,
    required this.good,
  });

  final String label;
  final String delta;
  final bool good;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 50),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: inter(14.5, color: palette.inkSoft)),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: good ? palette.successBg : palette.warnBg,
              borderRadius: BorderRadius.circular(NiaRadius.pill),
            ),
            child: Text(delta,
                style: niaLabel(12, weight: FontWeight.w700).copyWith(
                    color: good ? palette.success : palette.warn)),
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt 3–13 · the interaction gallery. Each card = the live component + a
// note on where it lands in AfriConnect.
// ─────────────────────────────────────────────────────────────────────────────

class ComponentsGallery extends StatelessWidget {
  const ComponentsGallery({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _DemoCard(
            index: 3,
            title: 'Overlap Row',
            note: 'Who\'s-online / recent-match avatar stack',
            child: OverlapRow(
              items: const [
                OverlapItem('Ada'),
                OverlapItem('Kwame'),
                OverlapItem('Zara'),
                OverlapItem('Tobi'),
                OverlapItem('Lia'),
                OverlapItem('Ngozi'),
              ],
            ),
          ),
          _DemoCard(
            index: 4,
            title: 'Magnify Row',
            note: 'Reaction / vibe picker — drag or tap to select',
            child: MagnifyRow(
              items: const [
                Icons.favorite_rounded,
                Icons.local_fire_department_rounded,
                Icons.star_rounded,
                Icons.bolt_rounded,
                Icons.emoji_emotions_rounded,
              ],
            ),
          ),
          _DemoCard(
            index: 5,
            title: 'Accordion Card',
            note: 'Expandable settings / FAQ row',
            child: AccordionCard(
              title: 'About Nia',
              leading: const Icon(Icons.info_rounded, size: 20),
              child: Text(
                'Nia is a curated space for intentional connections across '
                'the African diaspora.',
                style: inter(14, color: context.palette.muted),
              ),
            ),
          ),
          _DemoCard(
            index: 6,
            title: 'Segment',
            note: 'Profile / discovery tab switcher (sliding block + content)',
            child: SegmentedSwitcher<String>(
              options: const [
                SegmentedOption(value: 'm', label: 'Matches'),
                SegmentedOption(value: 'n', label: 'Nearby'),
                SegmentedOption(value: 'a', label: 'Activity'),
              ],
              selected: 'm',
              onChanged: (_) {},
              contentFor: (t) => Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text('Showing “$t” content…',
                    style: inter(14, color: context.palette.muted)),
              ),
            ),
          ),
          _DemoCard(
            index: 7,
            title: 'Accordion Row',
            note: 'Horizontal discovery category rail',
            child: AccordionRow(
              height: 180,
              items: [
                AccordionStrip(
                  title: 'Nearby',
                  detail: Text('12 people within 5 km',
                      style: inter(13, color: Colors.white)),
                ),
                AccordionStrip(
                  title: 'New',
                  detail: Text('8 fresh faces today',
                      style: inter(13, color: Colors.white)),
                ),
                AccordionStrip(
                  title: 'Online',
                  color: AppColors.gold,
                  detail: Text('23 active right now',
                      style: inter(13, color: Colors.white)),
                ),
              ],
            ),
          ),
          _DemoCard(
            index: 8,
            title: 'Progress Fill',
            note: 'Profile-completeness bar — the canonical fit',
            child: ProgressFill(
              items: const [
                'Add a photo',
                'Write your bio',
                'Verify your ID',
                'Set preferences',
              ],
            ),
          ),
          _DemoCard(
            index: 9,
            title: 'Card Tray',
            note: 'Media-detail tray under a profile photo',
            child: CardTray(
              main: Container(
                height: 96,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(NiaRadius.md),
                  gradient: const LinearGradient(
                    colors: [AppColors.clay, AppColors.plum],
                  ),
                ),
              ),
              details: const [
                TrayRow(label: 'Camera', value: 'iPhone 15'),
                TrayRow(label: 'Location', value: 'Lagos, NG'),
                TrayRow(label: 'Size', value: '2.4 MB'),
              ],
            ),
          ),
          _DemoCard(
            index: 10,
            title: 'Pull Summary',
            note: 'Collapsible stats header (pull down or tap)',
            child: PullSummary(
              collapsedLabel: 'This week at a glance',
              expanded: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('9 likes · 3 superlikes · 5 chats',
                      style: inter(15, weight: FontWeight.w700,
                          color: context.palette.onBrand)),
                  const SizedBox(height: 8),
                  Text('Your profile was viewed 41 times.',
                      style: inter(13, color: context.palette.onBrand)),
                ],
              ),
              child: Text(
                'This content dims and nudges down as the summary opens — '
                'placeholder for the feed below.',
                style: inter(13),
              ),
            ),
          ),
          _DemoCard(
            index: 11,
            title: 'Fluid Morph',
            note: 'FAB → filter panel morph (tap to expand)',
            child: Center(
              child: FluidMorph(
                closedLabel: 'Filters',
                openChild: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    _SheetToggle(label: 'Verified only'),
                    SizedBox(height: 10),
                    _SheetToggle(label: 'Online now'),
                    SizedBox(height: 10),
                    _SheetToggle(label: 'Within 10 km'),
                  ],
                ),
              ),
            ),
          ),
          _DemoCard(
            index: 12,
            title: 'Shared Element',
            note: 'Photo card → detail hero transition (tap a tile)',
            child: SharedElementGrid(
              items: const [
                SharedPhoto('se1', [AppColors.clay, AppColors.plum], 'Safari'),
                SharedPhoto('se2', [AppColors.gold, AppColors.clayDark], 'Gala'),
                SharedPhoto('se3', [AppColors.plum, AppColors.ink], 'Beach'),
                SharedPhoto('se4', [AppColors.clayDark, AppColors.gold], 'Studio'),
              ],
            ),
          ),
          _DemoCard(
            index: 13,
            title: 'Damped Bottom Sheet',
            note: 'Velocity-snapping sheet — open the demo',
            child: Center(
              child: PillCta(
                label: 'Open sheet',
                icon: Icons.vertical_align_bottom_rounded,
                onPressed: () => _openSheet(context),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openSheet(BuildContext context) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const _SheetDemoPage()),
    );
  }
}

class _SheetDemoPage extends StatelessWidget {
  const _SheetDemoPage();

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Scaffold(
      backgroundColor: palette.background,
      appBar: AppBar(
        backgroundColor: palette.background,
        foregroundColor: palette.ink,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text('Background content',
            style: inter(16, weight: FontWeight.w700)),
      ),
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: Text('Drag the sheet — release velocity snaps it.',
                  style: inter(14, color: palette.muted)),
            ),
          ),
          DampedBottomSheet(
            handleLabel: 'Filters',
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  _SheetToggle(label: 'Verified only'),
                  SizedBox(height: 12),
                  _SheetToggle(label: 'Online now'),
                  SizedBox(height: 12),
                  _SheetToggle(label: 'Within 10 km'),
                  SizedBox(height: 12),
                  _SheetToggle(label: 'Has photo'),
                  SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SheetToggle extends StatefulWidget {
  const _SheetToggle({required this.label});
  final String label;

  @override
  State<_SheetToggle> createState() => _SheetToggleState();
}

class _SheetToggleState extends State<_SheetToggle> {
  bool _on = false;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return GestureDetector(
      onTap: () => setState(() => _on = !_on),
      child: Row(
        children: [
          Expanded(child: Text(widget.label, style: inter(15, color: palette.ink))),
          Switch(
            value: _on,
            activeThumbColor: AppColors.clay,
            activeTrackColor: palette.brandSoft,
            onChanged: (v) => setState(() => _on = v),
          ),
        ],
      ),
    );
  }
}

class _DemoCard extends StatelessWidget {
  const _DemoCard({
    required this.index,
    required this.title,
    required this.note,
    required this.child,
  });

  final int index;
  final String title;
  final String note;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final palette = context.palette;
    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: SurfaceCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 26,
                  height: 26,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: palette.brandSoft,
                    borderRadius: BorderRadius.circular(NiaRadius.pill),
                  ),
                  child: Text('$index',
                      style: niaLabel(12, weight: FontWeight.w700)
                          .copyWith(color: palette.brandOn)),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(title,
                      style: inter(16, weight: FontWeight.w700, color: palette.ink)),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(note, style: inter(12.5, color: palette.muted)),
            const SizedBox(height: 16),
            child,
          ],
        ),
      ),
    );
  }
}
