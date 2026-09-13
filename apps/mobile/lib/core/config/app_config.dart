abstract final class AppConfig {
  static const webBaseUrl = String.fromEnvironment(
    'NIA_WEB_BASE_URL',
    defaultValue: 'https://africonnect.pro',
  );

  static Uri webUri(String path, [Map<String, String>? queryParameters]) {
    final root = webBaseUrl.endsWith('/')
        ? webBaseUrl.substring(0, webBaseUrl.length - 1)
        : webBaseUrl;
    return Uri.parse('$root$path').replace(queryParameters: queryParameters);
  }

  static Uri paymentReturn(String status) => webUri(
        '/portal/account',
        <String, String>{'payment': status},
      );
}
