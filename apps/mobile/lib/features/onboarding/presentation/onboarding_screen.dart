import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/services.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/nia_kit.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final name = TextEditingController();
  final school = TextEditingController();
  final workplace = TextEditingController();
  final expertise = TextEditingController();
  int step = 0;
  String? gender;
  int? birthMonth;
  int? birthYear;
  String? status;
  String? salary;
  final interests = <String>{};

  static const interestOptions = [
    'Travel', 'Art', 'Fitness', 'Food', 'Faith',
    'Music', 'Reading', 'Business', 'Nature', 'Community',
  ];
  static const expertiseOptions = [
    'Doctor', 'Lawyer', 'Designer', 'Engineer', 'Teacher', 'Finance',
    'Marketing', 'Technology', 'Healthcare', 'Entrepreneur', 'Other',
  ];

  @override
  void dispose() {
    name.dispose(); school.dispose(); workplace.dispose(); expertise.dispose();
    super.dispose();
  }

  Future<void> next() async {
    if (step == 0 && name.text.trim().isEmpty) return _error('Add your name to continue.');
    if (step == 1 && gender == null) return _error('Choose an option to continue.');
    if (step == 2 && (birthMonth == null || birthYear == null)) return _error('Choose your birth month and year.');
    if (step == 3 && interests.isEmpty) return _error('Choose at least one interest.');
    if (step < 4) return setState(() => step++);
    if (status == null || expertise.text.trim().isEmpty) return _error('Complete your work and expertise details.');
    if (status == 'student' && school.text.trim().isEmpty) return _error('Add your school.');
    if ((status == 'employed' || status == 'employed_student') && workplace.text.trim().isEmpty) return _error('Add your workplace.');
    try {
      await AppServices.account.updateProfile({
        'displayName': name.text.trim(),
        'gender': gender,
        'birthMonth': birthMonth,
        'birthYear': birthYear,
        'interests': interests.toList(),
        'employmentStatus': status,
        'profession': expertise.text.trim(),
        'school': school.text.trim(),
        'employer': workplace.text.trim(),
        'salaryRange': salary,
      });
      if (mounted) context.go('/');
    } catch (error) {
      _error(error.toString());
    }
  }

  void _error(String message) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));

  @override
  Widget build(BuildContext context) {
    final titles = ['What should we call you?', 'How do you identify?', 'When were you born?', 'What brings you joy?', 'A little about your work'];
    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 28, 24, 32),
          children: [
            Row(children: [
              if (step > 0) IconButton(onPressed: () => setState(() => step--), icon: const Icon(Icons.arrow_back_rounded)),
              const Spacer(),
              Text('${step + 1} of 5', style: inter(12, weight: FontWeight.w700, color: context.palette.muted)),
            ]),
            const SizedBox(height: 18),
            LinearProgressIndicator(value: (step + 1) / 5, minHeight: 6, borderRadius: BorderRadius.circular(99)),
            const SizedBox(height: 42),
            Text(titles[step], style: editorial(34, weight: FontWeight.w700)),
            const SizedBox(height: 10),
            Text(_subtitle, style: inter(14, color: context.palette.muted, height: 1.5)),
            const SizedBox(height: 30),
            _stepBody,
            const SizedBox(height: 34),
            PillCta(label: step == 4 ? 'Save and meet people' : 'Continue', expand: true, onPressed: next),
          ],
        ),
      ),
    );
  }

  String get _subtitle => switch (step) {
    0 => 'Use the name you want members to see.',
    1 => 'Choose what feels right. You can change visibility later.',
    2 => 'Your age helps us make thoughtful recommendations.',
    3 => 'Pick up to five. These help us find your common ground.',
    _ => 'This helps people understand your world without writing a long bio.',
  };

  Widget get _stepBody => switch (step) {
    0 => TextField(controller: name, autofocus: true, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Your name', hintText: 'e.g. Amara')),
    1 => _choiceList(['male', 'female', 'prefer_not_to_say'], {'male': 'Male', 'female': 'Female', 'prefer_not_to_say': 'Prefer not to say'}, gender, (value) => setState(() => gender = value)),
    2 => Row(children: [Expanded(child: DropdownButtonFormField<int>(initialValue: birthMonth, decoration: const InputDecoration(labelText: 'Month'), items: [for (var i = 1; i <= 12; i++) DropdownMenuItem(value: i, child: Text('$i'))], onChanged: (value) => setState(() => birthMonth = value))), const SizedBox(width: 12), Expanded(child: DropdownButtonFormField<int>(initialValue: birthYear, decoration: const InputDecoration(labelText: 'Year'), items: [for (var year = DateTime.now().year - 18; year >= 1940; year--) DropdownMenuItem(value: year, child: Text('$year'))], onChanged: (value) => setState(() => birthYear = value))) ]),
    3 => Wrap(spacing: 8, runSpacing: 10, children: [for (final item in interestOptions) FilterChip(label: Text(item), selected: interests.contains(item), onSelected: (selected) => setState(() { if (selected && interests.length < 5) interests.add(item); else interests.remove(item); }))]),
    _ => Column(children: [
      _choiceList(['student', 'employed', 'employed_student', 'retired'], {'student': 'Student', 'employed': 'Employed', 'employed_student': 'Employed student', 'retired': 'Retired'}, status, (value) => setState(() => status = value)),
      const SizedBox(height: 18),
      Autocomplete<String>(optionsBuilder: (value) => expertiseOptions.where((item) => item.toLowerCase().contains(value.text.toLowerCase())), onSelected: (value) => expertise.text = value, fieldViewBuilder: (_, controller, focusNode, __) { controller.text = expertise.text; return TextField(controller: controller, focusNode: focusNode, decoration: const InputDecoration(labelText: 'Area of expertise', hintText: 'Search or type your area')); }),
      if (status == 'student') ...[const SizedBox(height: 14), TextField(controller: school, decoration: const InputDecoration(labelText: 'School or university'))],
      if (status == 'employed' || status == 'employed_student') ...[const SizedBox(height: 14), TextField(controller: workplace, decoration: const InputDecoration(labelText: 'Workplace or organisation'))],
      const SizedBox(height: 14), DropdownButtonFormField<String>(initialValue: salary, decoration: const InputDecoration(labelText: 'Salary range'), items: const [DropdownMenuItem(value: 'below_20k', child: Text('Below R20k')), DropdownMenuItem(value: '20k_50k', child: Text('R20k–R50k')), DropdownMenuItem(value: '50k_100k', child: Text('R50k–R100k')), DropdownMenuItem(value: '100k_plus', child: Text('R100k+')), DropdownMenuItem(value: 'prefer_not_to_say', child: Text('Prefer not to say'))], onChanged: (value) => setState(() => salary = value)),
    ]),
  };

  Widget _choiceList(List<String> values, Map<String, String> labels, String? selected, ValueChanged<String> onChanged) => Column(children: [for (final value in values) RadioListTile<String>(value: value, groupValue: selected, title: Text(labels[value]!), contentPadding: EdgeInsets.zero, onChanged: (value) { if (value != null) onChanged(value); })]);
}
