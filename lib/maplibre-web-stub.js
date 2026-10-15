// Web stub for @maplibre/maplibre-react-native
// MapLibre RN is native-only; on web we export no-op components.
const React = require('react');
const { View, Text } = require('react-native');

function stub(name) {
  return React.forwardRef(function StubComponent(props, ref) {
    return props.children || null;
  });
}

const MapView = React.forwardRef(function MapViewStub(props, ref) {
  return React.createElement(
    View,
    { style: [{ backgroundColor: '#e0e0e0', alignItems: 'center', justifyContent: 'center' }, props.style] },
    React.createElement(Text, { style: { color: '#999', fontSize: 14 } }, 'Karte (nur auf Gerät verfügbar)'),
    props.children
  );
});

exports.MapView = MapView;
exports.Camera = stub('Camera');
exports.UserLocation = stub('UserLocation');
exports.ShapeSource = stub('ShapeSource');
exports.LineLayer = stub('LineLayer');
exports.PointAnnotation = stub('PointAnnotation');
exports.OfflineManager = {};
exports.setAccessToken = function () {};
exports.default = { MapView };
