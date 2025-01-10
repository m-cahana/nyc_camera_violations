import pandas as pd
import matplotlib.pyplot as plt
import numpy as np
from sodapy import Socrata
import googlemaps

# ----- functions -----
def generate_shares(df, violation_code):
    sub_df = df[df.violation_code == violation_code].reset_index()
    sub_df = sub_df.sort_values('violations')

    sub_df['row_num'] = range(len(sub_df))
    sub_df['row_pct'] = sub_df.row_num / sub_df.shape[0]

    sub_df['cum_share'] = sub_df.violations.cumsum() / sub_df.violations.sum()

    return sub_df

def visualize_distribution(df, violation_code) :

    sub_df = generate_shares(df, violation_code)

    violation_desc = sub_df.iloc[0].violation_description

    sub_df.plot(x = 'row_pct', y = 'cum_share')
    plt.title(f'violation code: {violation_desc}')

def bin_violations(violations):
    match violations:
        case _ if violations <=1 :
            return '1'
        case _ if 1 < violations <= 5:
            return '1-5'
        case _ if 5 < violations <= 10:
            return '6-10'
        case _ if 10 < violations <= 15:
            return '11-15'
        case _ if  15 < violations <= 50:
            return '16-50'
        case _ if  violations > 50:
            return '51+'


# Define a function to calculate step size with quadratic interpolation
def decreasing_step_quadratic(index, total_rows, max_step=500, min_step=100):
    """
    Calculate step size based on the index using a quadratic scale.
    Starts with `max_step` and decreases to `min_step`, accelerating towards the end.
    
    Parameters:
        index (int): Current row index.
        total_rows (int): Total number of rows in the DataFrame.
        max_step (int): Maximum step size (start of the DataFrame).
        min_step (int): Minimum step size (end of the DataFrame).
    
    Returns:
        int: Step size at the given index.
    """
    # Normalize the index to a range of 0 to 1
    progress = index / total_rows
    
    # Apply quadratic interpolation: (1 - progress^2) decreases slowly at first, then faster
    step = max_step - (max_step - min_step) * (progress ** 4)
    
    return int(step)

# ----- data read-in -----

violations_agg = pd.read_csv('../processed/parking_violations_agg_copy.csv')

# ---- categorize ----- 
red_light_agg = generate_shares(violations_agg, 7).rename(
    columns = {'violations':'red_light_violations'}
)
school_zone_agg = generate_shares(violations_agg, 36).rename(
    columns = {'violations':'school_zone_violations'}
)

school_zone_agg['school_zone_violations_binned'] = school_zone_agg.school_zone_violations.apply(bin_violations)

# ---- merge ----- 

merged = school_zone_agg.merge(
    red_light_agg[['plate_id', 'red_light_violations']], 
    how = 'left', 
    on = 'plate_id')
merged['red_light_violations'] = merged.red_light_violations.fillna(0)

# ----- save output -----

merged.to_csv('../processed/school_zone_violations.csv', index = False)

merged.iloc[::1000, :].to_csv('../processed/school_zone_violations_sparse.csv', index = False)

# Initialize variables
selected_indices = []
i = 0

# Iterate to select rows
while i < len(merged):
    selected_indices.append(i)
    step = decreasing_step_quadratic(i, len(merged), max_step=10000, min_step=1000)
    i += step

# Select rows based on calculated indices
sparse_gradual_merged = merged.iloc[selected_indices]

# Show the result
spars