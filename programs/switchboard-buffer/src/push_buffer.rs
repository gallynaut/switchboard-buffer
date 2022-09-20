use anchor_lang::prelude::*;
use anchor_spl::token::{
    burn, Burn, close_account, CloseAccount, Mint, Token, TokenAccount, transfer, Transfer,
};
use serde_json::Value;
pub use switchboard_v2::{AggregatorAccountData, SWITCHBOARD_PROGRAM_ID};
use switchboard_v2::{BufferRelayerAccountData, SWITCHBOARD_V2_DEVNET, SWITCHBOARD_V2_MAINNET};

use MyBufferErrorCode::{BadGameSchema, InvalidSwitchboardAccount, StringConversionFailed};
use MyErrorCode::WithdrawBlocked;

use super::*;

pub fn push_buffer(
    ctx: Context<PushBuffer>,
) -> Result<()> {


    let buffer_account = &ctx.accounts.event_buffer_relayer;

    // check buffer owner
    let owner = *buffer_account.owner;
    if owner != SWITCHBOARD_V2_DEVNET && owner != SWITCHBOARD_V2_MAINNET {
        return Err(error!(InvalidSwitchboardAccount));
    }

    // load and deserialize buffer
    let buffer = BufferRelayerAccountData::new(buffer_account)?;

    let buffer_result = buffer.get_result();

    let result_string =
        String::from_utf8(buffer.result).map_err(|_| error!(StringConversionFailed))?;

    msg!("result {:?}", result_string);
    let parsed: serde_json::Value =
        serde_json::from_str(result_string.as_str()).map_err(|_| error!(BadGameSchema))?;

    let g1 = parsed.as_array().ok_or_else(|| error!(BadGameSchema))?;
    let g2 = g1[0].as_array().ok_or_else(|| error!(BadGameSchema))?;
    let g3: Vec<&Vec<Value>> = g1[1]
        .as_array()
        .ok_or_else(|| error!(BadGameSchema))?
        .iter()
        .map(|x| x.as_array().ok_or_else(|| error!(BadGameSchema)).unwrap())
        .collect();

    msg!("{:?}", g3.clone()[0][0].to_string());

    msg!("Buffer action 2 success");

    Ok(())
}

#[derive(Accounts)]
pub struct PushBuffer<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    /// CHECK:
    pub event_buffer_relayer: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

