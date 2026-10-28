/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from "react";
import api from "../../utils/api";
import "./TravelHistory.css";
import "../../styles/commuter-banner.css";
import { History } from "lucide-react";

const TravelHistory = ({ userId: _userId }) => {
  const [travelHistory, setTravelHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState({
    period: "month",
    status: "all",
  });
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [ratingData, setRatingData] = useState({
    rating: 5,
    feedback: "",
    complaints: [],
  });

  const fetchTravelHistory = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        period: filter.period,
        status: filter.status !== "all" ? filter.status : "",
      });

      const response = await api.get(
        `/travel-history/my-history?${queryParams}`,
      );
      const data = response.data;

      console.log('queryParams', queryParams);

      console.log("data", data);


      if (data.success) {
        // Handle both 'history' and 'travelHistory' response keys for backward compatibility
        setTravelHistory(data.data.history || data.data.travelHistory || []);
      } else {
        setError(data.message || "Failed to fetch travel history");
      }
    } catch (error) {
      console.error("Error fetching travel history:", error);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchTravelHistory();
  }, [fetchTravelHistory]);

  const handleRateTrip = (trip) => {
    setSelectedTrip(trip);
    setShowRatingModal(true);
  };

  const handleRatingSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await api.post(
        `/travel-history/rate/${selectedTrip._id}`,
        ratingData,
      );
      const data = response.data;

      if (data.success) {
        // Update the trip in the list
        setTravelHistory((prev) =>
          prev.map((trip) =>
            trip._id === selectedTrip._id
              ? {
                  ...trip,
                  rating: ratingData.rating,
                  feedback: ratingData.feedback,
                }
              : trip,
          ),
        );
        setShowRatingModal(false);
        setSelectedTrip(null);
        setRatingData({ rating: 5, feedback: "", complaints: [] });
      } else {
        setError(data.message || "Failed to submit rating");
      }
    } catch (error) {
      console.error("Error submitting rating:", error);
      setError("Network error. Please try again.");
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (timeString) => {
    const time = new Date(timeString);
    return time.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="dmg-travel-history-loading">
        <div className="dmg-spinner"></div>
        <p>Loading travel history...</p>
      </div>
    );
  }

  return (
    <div className="dmg-travel-history-container">
      <header className="dmg-banner">
        <div className="dmg-banner-main">
          <span className="dmg-banner-icon">
            <History />
          </span>
          <div className="dmg-banner-text">
            <span className="dmg-banner-eyebrow">Your journeys</span>
            <h3 className="dmg-banner-title">My Travel History</h3>
            <p className="dmg-banner-sub">
              Review every trip you&apos;ve taken and track your spend.
            </p>
          </div>
        </div>
      </header>

      <div className="dmg-travel-history-header">
        <div className="dmg-filters">
          <select
            value={filter.period}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, period: e.target.value }))
            }
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>

          <select
            value={filter.status}
            onChange={(e) =>
              setFilter((prev) => ({ ...prev, status: e.target.value }))
            }
          >
            <option value="all">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="NO_SHOW">No Show</option>
          </select>
        </div>
      </div>

      {error && <div className="dmg-error-message">{error}</div>}

      <div className="dmg-travel-history-list">
        {travelHistory.length === 0 ? (
          <div className="dmg-no-history">
            <p>No travel history found for the selected period.</p>
          </div>
        ) : (
          travelHistory.map((trip, index) => (
            <div key={trip._id} className="dmg-travel-history-item">
              <div className="dmg-trip-date">
                <div className="dmg-date">{formatDate(trip.tripDate)}</div>
                <div className="dmg-time">
                  {formatTime(trip.actualStartTime || trip.scheduledStartTime)}
                </div>
              </div>

              <div className="dmg-trip-route">
                <div className="dmg-route-info">
                  <span className="dmg-pickup">{trip.pickupLocation}</span>
                  <span className="dmg-arrow">→</span>
                  <span className="dmg-dropoff">{trip.dropoffLocation}</span>
                </div>
                <div className="dmg-trip-details">
                  <span className="dmg-vehicle">{trip.vehicleType}</span>
                  <span className="dmg-driver">Driver: {trip.driverName}</span>
                </div>
              </div>

              <div className="dmg-trip-status">
                <span className={`dmg-status ${trip.status.toLowerCase()}`}>
                  {trip.status.replace(/_/g, " ")}
                </span>
                {trip.rating && (
                  <div className="dmg-rating">
                    {"★".repeat(Math.floor(trip.rating))}
                    {"☆".repeat(5 - Math.floor(trip.rating))}
                  </div>
                )}
              </div>

              <div className="dmg-trip-actions">
                {trip.status === "COMPLETED" && !trip.rating && (
                  <button
                    className="dmg-rate-btn"
                    onClick={() => handleRateTrip(trip)}
                  >
                    Rate Trip
                  </button>
                )}
                {trip.noShowId && (
                  <button className="dmg-no-show-badge">No Show</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showRatingModal && (
        <div className="dmg-rating-overlay">
          <div className="dmg-rating-modal">
            <div className="dmg-rating-header">
              <h3>Rate Your Trip</h3>
              <button
                className="dmg-close-btn"
                onClick={() => setShowRatingModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleRatingSubmit} className="dmg-rating-form">
              <div className="dmg-trip-summary">
                <p>
                  <strong>Date:</strong> {formatDate(selectedTrip?.tripDate)}
                </p>
                <p>
                  <strong>Route:</strong> {selectedTrip?.pickupLocation} →{" "}
                  {selectedTrip?.dropoffLocation}
                </p>
              </div>

              <div className="dmg-form-group">
                <label>Rating</label>
                <div className="dmg-star-rating">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={`dmg-star ${star <= ratingData.rating ? "dmg-active" : ""}`}
                      onClick={() =>
                        setRatingData((prev) => ({ ...prev, rating: star }))
                      }
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="dmg-form-group">
                <label>Feedback</label>
                <textarea
                  value={ratingData.feedback}
                  onChange={(e) =>
                    setRatingData((prev) => ({
                      ...prev,
                      feedback: e.target.value,
                    }))
                  }
                  rows="4"
                  placeholder="Share your experience..."
                />
              </div>

              <div className="dmg-form-actions">
                <button
                  type="button"
                  className="dmg-cancel-btn"
                  onClick={() => setShowRatingModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="dmg-submit-btn">
                  Submit Rating
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TravelHistory;
