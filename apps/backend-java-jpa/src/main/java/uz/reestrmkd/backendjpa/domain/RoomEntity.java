package uz.reestrmkd.backendjpa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Entity
@Table(name = "rooms")
public class RoomEntity extends BaseEntity {

    @Column(name = "unit_id", nullable = false)
    private String unitId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unit_id", insertable = false, updatable = false)
    private UnitEntity unit;

    @Column(name = "room_type")
    private String roomType;

    @Column(name = "name")
    private String name;

    @Column(name = "area")
    private BigDecimal area;

    @Column(name = "room_height")
    private BigDecimal roomHeight;

    @Column(name = "level")
    private Integer level = 1;

    @Column(name = "is_mezzanine", nullable = false)
    private Boolean isMezzanine = false;
}
