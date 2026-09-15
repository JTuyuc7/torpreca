import 'package:flutter/material.dart';

import '../../auth/data/auth_repository.dart';
import '../../map/presentation/map_screen.dart';
import '../../profile/presentation/profile_screen.dart';
import '../../reports/presentation/daily_report_screen.dart';
import '../../stops/presentation/stops_screen.dart';

/// Root shell after login (TOR-29) — an M3 [NavigationBar] with the app's
/// 4 tabs, landing on Paradas (Sistema de Diseño updated 15 sep 2026: Mapa
/// principal is no longer the immediate post-login screen — jumping
/// straight into a live Mapbox view felt abrupt, and most sessions won't
/// touch the map before picking a route anyway).
///
/// Each tab is only built the first time it's selected — tracked by
/// [_visited] — and then kept alive in the [IndexedStack] like the other
/// tabs (e.g. [MapScreen]'s tracking session doesn't restart when the driver
/// checks another tab). This is what makes landing on Paradas actually save
/// anything: Mapbox never initializes unless the driver opens the Mapa tab.
class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.authRepository});

  final AuthRepository authRepository;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _index = 0;
  final Set<int> _visited = {0};

  void _onDestinationSelected(int index) {
    setState(() {
      _index = index;
      _visited.add(index);
    });
  }

  @override
  Widget build(BuildContext context) {
    final tabBuilders = <Widget Function()>[
      () => const StopsScreen(),
      () => MapScreen(authRepository: widget.authRepository),
      () => const DailyReportScreen(),
      () => const ProfileScreen(),
    ];

    return Scaffold(
      body: IndexedStack(
        index: _index,
        children: [
          for (var i = 0; i < tabBuilders.length; i++)
            if (_visited.contains(i)) tabBuilders[i]() else const SizedBox.shrink(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _onDestinationSelected,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.location_on_outlined),
            selectedIcon: Icon(Icons.location_on),
            label: 'Paradas',
          ),
          NavigationDestination(icon: Icon(Icons.map_outlined), selectedIcon: Icon(Icons.map), label: 'Mapa'),
          NavigationDestination(
            icon: Icon(Icons.assignment_outlined),
            selectedIcon: Icon(Icons.assignment),
            label: 'Reporte',
          ),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Perfil'),
        ],
      ),
    );
  }
}
