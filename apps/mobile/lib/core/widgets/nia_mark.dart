import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class NiaMark extends StatelessWidget {
  const NiaMark({super.key, this.size = 48, this.showWordmark = false});

  final double size;
  final bool showWordmark;

  @override
  Widget build(BuildContext context) {
    final mark = Semantics(
      label: 'Nia',
      image: true,
      child: CustomPaint(
        size: Size.square(size),
        painter: const _NiaMarkPainter(
          red: AppColors.clay,
          plum: AppColors.plum,
          magenta: AppColors.gold,
        ),
      ),
    );
    if (!showWordmark) return mark;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        mark,
        const SizedBox(width: 10),
        Text('Nia', style: editorial(size * .62, weight: FontWeight.w700)),
      ],
    );
  }
}

class _NiaMarkPainter extends CustomPainter {
  const _NiaMarkPainter(
      {required this.red, required this.plum, required this.magenta});

  final Color red;
  final Color plum;
  final Color magenta;

  @override
  void paint(Canvas canvas, Size size) {
    final center = size.center(Offset.zero);
    final radius = size.shortestSide * .45;
    canvas.drawCircle(center, radius, Paint()..color = plum);

    final left = size.width * .30;
    final middle = size.width * .50;
    final right = size.width * .70;
    final top = size.height * .30;
    final bottom = size.height * .70;
    final redPaint = Paint()
      ..color = red
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.shortestSide * .0625
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    final monogram = Path()
      ..moveTo(left, bottom)
      ..lineTo(middle, top)
      ..lineTo(right, bottom)
      ..moveTo(middle, top)
      ..lineTo(middle, bottom);
    canvas.drawPath(monogram, redPaint);
    canvas.drawCircle(center, size.shortestSide * .075, Paint()..color = red);

    final smile = Path()
      ..moveTo(size.width * .35, size.height * .55)
      ..cubicTo(
        size.width * .42,
        size.height * .62,
        size.width * .58,
        size.height * .62,
        size.width * .65,
        size.height * .55,
      );
    canvas.drawPath(
      smile,
      Paint()
        ..color = magenta
        ..style = PaintingStyle.stroke
        ..strokeWidth = size.shortestSide * .0375
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_NiaMarkPainter oldDelegate) =>
      oldDelegate.red != red ||
      oldDelegate.plum != plum ||
      oldDelegate.magenta != magenta;
}
