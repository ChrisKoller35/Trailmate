export default class KalmanFilter {
  private lat: number = 0;
  private lng: number = 0;
  private variance: number = -1; // negative means uninitialized

  process(lat: number, lng: number, accuracy: number): { lat: number; lng: number } {
    const acc = Math.max(accuracy, 3);

    if (this.variance < 0) {
      // First measurement — initialize directly
      this.lat = lat;
      this.lng = lng;
      this.variance = acc * acc;
    } else {
      // Predict phase — variance grows with each measurement
      this.variance += acc * acc;

      // Update phase — compute Kalman gain
      const gain = this.variance / (this.variance + acc * acc);
      this.lat += gain * (lat - this.lat);
      this.lng += gain * (lng - this.lng);
      this.variance *= 1 - gain;
    }

    return { lat: this.lat, lng: this.lng };
  }
}
