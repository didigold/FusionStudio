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
                           min_cluster_duration=0.1, mask_start=6.0):
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
        tuple (start_time, duration) or (None, None) if no valid events
    """
    import numpy as np
    samples = np.asarray(samples, dtype=float)
    timestamps = np.asarray(timestamps, dtype=float)
    
    if len(samples) == 0 or len(timestamps) == 0:
        return None, None
    
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
        return None, None
    
    # Ignore initial noise
    mask = mask & (timestamps >= mask_start)
    
    if not np.any(mask):
        return None, None
    
    # Find edges (rising/falling) of the mask
    padded = np.concatenate(([False], mask, [False]))
    diff = np.diff(padded.astype(int))
    starts = np.flatnonzero(diff == 1)   # indices where True begins
    ends = np.flatnonzero(diff == -1)     # indices where True ends (exclusive)
    
    if len(starts) == 0:
        return None, None
    
    # Support bridging gaps between spikes (useful for sound waves and AM modulation dips)
    max_gap_duration = 0.5  # 500ms gap allowed
    
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
            
    # 1. Extract valid clusters and calculate their peaks
    valid_clusters = []
    for s, e in zip(merged_starts, merged_ends):
        s_clamped = min(s, len(timestamps) - 1)
        e_clamped = min(e - 1, len(timestamps) - 1)  # inclusive end
        
        cluster_start = timestamps[s_clamped]
        cluster_end = timestamps[e_clamped]
        duration = cluster_end - cluster_start
        
        if duration >= min_cluster_duration:
            peak_val = np.max(samples[s_clamped:e_clamped+1])
            valid_clusters.append({
                'start': cluster_start,
                'end': cluster_end,
                'duration': duration,
                'peak': peak_val
            })

    if not valid_clusters:
        return None, None

    # 2. Group into chains separated by <= 2.5 seconds
    chains = []
    current_chain = [valid_clusters[0]]
    for i in range(1, len(valid_clusters)):
        prev = current_chain[-1]
        curr = valid_clusters[i]
        if curr['start'] - prev['end'] <= 2.5:
            current_chain.append(curr)
        else:
            chains.append(current_chain)
            current_chain = [curr]
    chains.append(current_chain)

    # 3. Evaluate chains
    for chain in chains:
        # Trim trailing outliers (e.g., noise spikes merged at the end)
        if len(chain) > 2:
            peaks = [c['peak'] for c in chain]
            median_peak = np.median(peaks)
            while len(chain) > 2:
                last_peak = chain[-1]['peak']
                # If peak is drastically different from median, pop it
                if last_peak > 1.8 * median_peak or last_peak < 0.4 * median_peak:
                    chain.pop()
                else:
                    break

        chain_start = chain[0]['start']
        chain_end = chain[-1]['end']
        total_duration = chain_end - chain_start
        
        # Condition 1: Long continuous warning
        if total_duration >= 3.0:
            return chain_start, total_duration
            
        # Condition 2: Repeating warning (multiple beeps)
        if len(chain) > 1:
            return chain_start, total_duration

    # No cluster met the criteria
    return None, None

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
            lookup_names = [signal_name]
            if signal_name == 'SoundPressure':
                lookup_names = ['SoundPressure', 'MySound PressureTask.Sound Pressure']
            elif signal_name == 'MySound PressureTask.Sound Pressure':
                lookup_names = ['MySound PressureTask.Sound Pressure', 'SoundPressure']
                
            pressure_signal = None
            for name in lookup_names:
                if name in mdf:
                    pressure_signal = mdf.get(name)
                    break
            
            if pressure_signal is None:
                # Try searching case insensitive or partial
                found = False
                for name in lookup_names:
                    for ch in mdf.iter_channels():
                        if name.lower() in ch.name.lower():
                            pressure_signal = ch
                            found = True
                            break
                    if found:
                        break
                if not found:
                    return None, f"Signal '{signal_name}' not found in {file_path}"

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
