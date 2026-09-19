import 'dart:math';

import 'package:flutter/material.dart';

class SwipeGesture {
  SwipeGesture({
    required this.onSwipeLeft,
    required this.onSwipeRight,
    required this.onTap,
    this.threshold = 90.0,
    this.disabled = false,
  });

  final VoidCallback? onSwipeLeft;
  final VoidCallback? onSwipeRight;
  final VoidCallback? onTap;
  final double threshold;
  final bool disabled;

  double dx = 0;
  double dy = 0;
  bool dragging = false;
  Offset? _start;
  int? _startTime;

  void onPointerDown(PointerDownEvent event) {
    if (disabled) return;
    _start = event.localPosition;
    _startTime = DateTime.now().millisecondsSinceEpoch;
    dx = 0;
    dy = 0;
    dragging = true;
  }

  void onPointerMove(PointerMoveEvent event) {
    if (_start == null || disabled) return;
    dx = event.localPosition.dx - _start!.dx;
    dy = event.localPosition.dy - _start!.dy;
  }

  void onPointerUp(PointerUpEvent event) {
    _finish(event.localPosition);
  }

  void onPointerCancel(PointerCancelEvent event) {
    _finish(event.localPosition);
  }

  void _finish(Offset position) {
    if (_start == null || disabled) return;
    final dxv = position.dx - _start!.dx;
    final dyv = position.dy - _start!.dy;
    final moved = sqrt(dxv * dxv + dyv * dyv);
    final dt = DateTime.now().millisecondsSinceEpoch - (_startTime ?? 0);

    dragging = false;
    dx = 0;
    dy = 0;
    _start = null;
    _startTime = null;

    // A short, small movement is a tap
    if (moved < 12 && dt < 400) {
      onTap?.call();
      return;
    }

    // A decisive horizontal drag commits like (right) / pass (left)
    if (dxv.abs() > threshold && dxv.abs() > dyv.abs()) {
      if (dxv > 0) {
        onSwipeRight?.call();
      } else {
        onSwipeLeft?.call();
      }
    }
  }
}

class SwipeDetector extends StatelessWidget {
  const SwipeDetector({
    super.key,
    required this.child,
    required this.gesture,
  });

  final Widget child;
  final SwipeGesture gesture;

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: gesture.onPointerDown,
      onPointerMove: gesture.onPointerMove,
      onPointerUp: gesture.onPointerUp,
      onPointerCancel: gesture.onPointerCancel,
      child: child,
    );
  }
}
