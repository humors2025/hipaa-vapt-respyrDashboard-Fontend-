"use client"
import { Modal } from "react-responsive-modal";
import React, {useState} from "react";
import CreateDietPlan from "../create-diet-plan";
export default function Expand({ open, onClose }) {
   

    const handleToggleExpand = () => {
        onClose(); 
    };

    return (
        <>
            <Modal
                open={open}
                onClose={onClose}
                center
                focusTrapped
                closeOnOverlayClick
                showCloseIcon={false}
                classNames={{ modal: "rounded-[10px] px-[25px] hide-scrollbar", overlay: "bg-black/40" }}
                styles={{ modal: { padding: 0, maxWidth: 1360, width: "90%", maxHeight: "90vh", 

                  
                  
                } }}
                aria-labelledby="create-plan-title"
            >

                <div 
                style={{
                    width: '100%',
                    height: '100%',
                    overflowY: 'auto',
                    flex: 1,
                    scrollbarWidth: 'none',
                    msOverflowStyle: 'none'
                }}
                className="hide-scrollbar"
            >
               <CreateDietPlan  isExpanded={true} 
                        onToggleExpand={handleToggleExpand} />
            </div>

            </Modal>
        </>
    )
}