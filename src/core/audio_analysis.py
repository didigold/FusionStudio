# Heavy imports are deferred to function scope to prevent startup crashes

def butter_bandpass(lowcut, highcut, fs, order=5):
    from scipy.signal import butter
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return b, a

def butter_bandpass_filter(data, lowcut, highcut, fs, order=5):
    from scipy.signal import lfilter
    b, a = butter_bandpass(lowcut, highcut, fs, order=order)
    y = lfilter(b, a, data)
    return y


def find_first_valid_event(samples, timestamps, threshold, operator='>',
                           min_cluster_duration=0.05, mask_start=6.0):
    """
    Clustering-based detection that eliminates single-spike false positives.
    
    Groups matching samples into clusters and returns the start time
    of the FIRST cluster whose duration >= min_cluster_duration.
    Isolated spikes shorter than min_cluster_duration are discarded
    as false positives (noise).
    
    Args:
        samples: numpy array of signal values (already filtered if needed)
        timestamps: numpy array of timestamps
        threshold: numeric threshold value
        operator: comparison operator string ('>', '<', '>=', '<=', '==', '!=')
        min_cluster_duration: minimum seconds for a cluster to be valid (default 50ms)
        mask_start: ignore samples before this time (default 6.0s)
    
    Returns:
        float or None: start time of the first valid cluster, or None if no valid events
    """
    import numpy as np
    samples = np.asarray(samples, dtype=float)
    timestamps = np.asarray(timestamps, dtype=float)
    
    if len(samples) == 0 or len(timestamps) == 0:
        return None
    
    # Build boolean mask based on operator
    if operator == '>':
        mask = samples > threshold
    elif operator == '<':
        mask = samples < threshold
    elif operator == '>=':
        mask = samples >= threshold
    elif operator == '<=':
        mask = samples <= threshold
    elif operator == '==':
        mask = np.abs(samples - threshold) < 1e-6
    elif operator == '!=':
        mask = np.abs(samples - threshold) >= 1e-6
    else:
        return None
    
    # Ignore initial noise
    mask = mask & (timestamps >= mask_start)
    
    if not np.any(mask):
        return None
    
    # Find edges (rising/falling) of the mask
    padded = np.concatenate(([False], mask, [False]))
    diff = np.diff(padded.astype(int))
    starts = np.flatnonzero(diff == 1)   # indices where True begins
    ends = np.flatnonzero(diff == -1)     # indices where True ends (exclusive)
    
    if len(starts) == 0:
        return None
    
    # Support bridging gaps between spikes (useful for sound waves)
    max_gap_duration = 0.05  # 50ms gap allowed
    
    # Merge clusters
    merged_starts = [starts[0]]
    merged_ends = [ends[0]]
    
    for s, e in zip(starts[1:], ends[1:]):
        gap = timestamps[s] - timestamps[min(merged_ends[-1], len(timestamps)-1)]
        if gap <= max_gap_duration:
            merged_ends[-1] = e
        else:
            merged_starts.append(s)
            merged_ends.append(e)
            
    # Return the FIRST cluster that meets the minimum duration
    for s, e in zip(merged_starts, merged_ends):
        # Clamp to valid indices
        s_clamped = min(s, len(timestamps) - 1)
        e_clamped = min(e - 1, len(timestamps) - 1)  # inclusive end
        
        cluster_start = timestamps[s_clamped]
        cluster_end = timestamps[e_clamped]
        duration = cluster_end - cluster_start
        
        if duration >= min_cluster_duration:
            return cluster_start
    
    # No cluster met the minimum duration — all were noise spikes
    return None

def obtain_peak_frequency(file_path, start_time=9, end_time=10.5, min_freq=230, max_freq=2000, signal_name='SoundPressure'):
    """
    Analyzes an MF4 file to find the peak frequency within a specific time window and frequency band.
    Returns:
        float: Peak frequency in Hz
        str: Error message if any, else None
    """
    try:
        import numpy as np
        from asammdf import MDF
        with MDF(file_path) as mdf:
            # Try to get the signal
            if signal_name not in mdf:
                # Try searching case insensitive or partial
                found = False
                for ch in mdf.iter_channels():
                    if signal_name.lower() in ch.name.lower():
                        pressure_signal = ch
                        found = True
                        break
                if not found:
                    return None, f"Signal '{signal_name}' not found in {file_path}"
            else:
                pressure_signal = mdf.get(signal_name)

            timestamps = pressure_signal.timestamps
            samples = pressure_signal.samples
            
            # Create DataFrame logic replacement (numpy is faster/lighter usually but sticking to logic)
            # Filter time window
            mask = (timestamps >= start_time) & (timestamps <= end_time)
            t_window = timestamps[mask]
            
            # If no data in window, try to find ANY data or warn
            if len(t_window) == 0:
                 # Fallback: analyze representative chunk or all?
                 # Let's return error for now as the logic relies on this window
                 return None, f"No data in time window {start_time}-{end_time}s"
            
            sig_window = samples[mask]
            
            # Fs calculation
            if len(t_window) > 1:
                duration = t_window[-1] - t_window[0]
                if duration == 0: fs = 44100 # Safe default?
                else: fs = len(sig_window) / duration
            else:
                 return None, "Not enough samples to calculate Fs"

            # Filter
            filtered_signal = butter_bandpass_filter(sig_window, min_freq, max_freq, fs, order=6)

            # FFT
            n = len(filtered_signal)
            fft_result = np.fft.fft(filtered_signal)
            freq = np.fft.fftfreq(n, d=1/fs)
            
            # Positive freqs only
            positive_mask = freq > 0
            fft_pos = fft_result[positive_mask]
            freq_pos = freq[positive_mask]
            
            if len(fft_pos) == 0:
                return None, "FFT failed (no positive frequencies)"

            # Peak
            peak_idx = np.argmax(np.abs(fft_pos))
            peak_freq = freq_pos[peak_idx]
            
            return peak_freq, None

    except Exception as e:
        return None, str(e)
